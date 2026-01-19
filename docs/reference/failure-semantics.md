# Failure Semantics & Retry Strategy

**Last Updated:** 2026-01-19  
**Status:** Active

This document defines what failures mean, when retries happen, and when events become permanently
failed.

---

## Core Principle

**Failures are not all equal.** Some are temporary (network blip), some are permanent (invalid
signature). We retry temporary failures, but stop retrying permanent ones.

---

## Two Layers of Reliability (Outbox vs Queue)

This system has **two distinct retry boundaries**:

1. **Outbox retry (DB-backed enqueue/cancel step)**
   - Purpose: reliably translate domain changes into queue operations (enqueue/cancel).
   - Storage: `OutboxEvent` row in Postgres.
   - Retry decision: based on error classification + bounded retry policy.
   - Terminal outcome: `deadLetteredAt` set on the outbox event.

2. **Queue retry (BullMQ job execution step)**
   - Purpose: reliably publish to relays once a job is enqueued.
   - Storage: Redis/BullMQ job state + DB idempotency + publish lease.
   - Terminal outcome: `DeadLetterJob` entry + domain state transitions (e.g. `FAILED`).

These layers address different failure modes. A publish can fail because:

- The outbox couldn't enqueue/cancel (Redis down, transient infra error) — **outbox retry**.
- The queue job ran but publishing failed (relay/network issues, validation issues) — **queue
  retry**.

---

## Failure Classification

### Temporary Failures (Retryable)

**Definition:** Failures that might succeed on retry, typically due to transient conditions.

**Examples:**

- Network timeouts
- Connection refused (relay temporarily down)
- HTTP 502/503/504 (server errors)
- DNS resolution failures
- Rate limiting (temporary)

**Characteristics:**

- Error is transient (not permanent)
- Retrying might succeed
- No user action required

**Retry Strategy:**

- Exponential backoff with jitter
- Maximum 5 attempts for scheduled posts
- Maximum 2 attempts for checker jobs
- Delay increases: 2s → 4s → 8s → 16s → 32s (capped at 60s)

**State Transitions:**

- `SCHEDULED` → `PUBLISHING` → `FAILED` (if retries exhausted)
- `FAILED` → `SCHEDULED` (if user retries)

---

### Permanent Failures (Non-Retryable)

**Definition:** Failures that will not succeed on retry, typically due to invalid data or
configuration.

**Examples:**

- Invalid signature (cryptographic verification fails)
- Post not found (deleted before publishing)
- Already published (idempotency check)
- Unauthorized (user permissions changed)
- Validation errors (invalid event structure)

**Characteristics:**

- Error is permanent (won't change on retry)
- User action required to fix
- Should not be retried automatically

**Retry Strategy:**

- **No automatic retries**
- Move to dead letter queue immediately
- User can manually retry after fixing issue

**State Transitions:**

- `SCHEDULED` → `PUBLISHING` → `FAILED` (immediately)
- `FAILED` → `SCHEDULED` (only if user fixes and retries)

---

## Outbox Failure Semantics (DB-backed)

### OutboxEvent lifecycle

- **Pending**: `processedAt = null` and `deadLetteredAt = null`
- **Eligible / Ready**: pending and `scheduledFor <= now` and `nextAttemptAt <= now` and lock free
- **Claimed**: `processingLockId` + `processingLockExpiresAt` set (prevents double-processing)
- **Succeeded**: `processedAt` set, retry/lock fields cleared
- **Retrying**: `attempts` incremented, `nextAttemptAt` set, `lastError` recorded
- **Dead-lettered**: `deadLetteredAt` set (terminal)

### Outbox retry policy

Default policy (enqueue/cancel step):

- Max attempts: **5**
- Base delay: **2s**
- Multiplier: **2** (exponential)
- Jitter: **±15%**
- Max delay: **10 minutes**

### Outbox terminal outcomes

Outbox events are dead-lettered when:

1. **Non-retryable error** (e.g. invalid payload / schema/version failures)
2. **Max attempts reached** (bounded retries exhausted)

Outbox dead-lettering is recorded on the `OutboxEvent` row (not in `DeadLetterJob`).

---

## Failure States

### State: `PUBLISHING`

**Meaning:** Post is currently being published.

**When it happens:**

- Worker picks up scheduled post
- Publishing to Nostr relays

**What can go wrong:**

- Network failure (temporary)
- Relay down (temporary)
- Invalid signature (permanent)
- Post deleted (permanent)

**Next states:**

- `PUBLISHED` (success)
- `FAILED` (failure)

---

### State: `FAILED`

**Meaning:** Post failed to publish.

**When it happens:**

- Retries exhausted (temporary failure)
- Permanent failure detected (non-retryable error)

**What it means:**

- Post did not publish to Nostr
- Post is in failed state
- User can retry or cancel

**Next states:**

- `SCHEDULED` (user retries)
- `DRAFT` (user edits and reschedules)
- `CANCELLED` (user cancels)

**Analytics:**

- Counted as failed post
- Included in failure metrics
- Not counted as published

---

## Retry Policy

### Scheduled Posts

**Configuration:**

- Max attempts: 5
- Base delay: 2 seconds
- Max delay: 60 seconds
- Multiplier: 2 (exponential)
- Jitter: ±15%

**Retry Schedule:**

- Attempt 1: Immediate
- Attempt 2: ~2s delay (1.7s - 2.3s with jitter)
- Attempt 3: ~4s delay (3.4s - 4.6s)
- Attempt 4: ~8s delay (6.8s - 9.2s)
- Attempt 5: ~16s delay (13.6s - 18.4s)

**Total time:** ~30 seconds (if all retries fail)

---

### Longform Posts

**Configuration:**

- Same as scheduled posts (5 attempts, exponential backoff)

---

### Post Checker Jobs

**Configuration:**

- Max attempts: 2
- Base delay: 5 seconds
- Max delay: 30 seconds
- Multiplier: 2
- Jitter: ±10%

**Rationale:** Checker jobs are less critical, fewer retries needed.

---

## Dead Letter Queue

### When Jobs Go to Dead Letter Queue

**Conditions:**

1. All retries exhausted (temporary failure)
2. Permanent failure detected (non-retryable error)

**What's stored:**

- Original job data (post content, signed event)
- Error message
- Error stack trace
- Number of attempts made
- Correlation ID (for tracing)

**Privacy implications:**

- Contains sensitive data (post content, signed events)
- Should be encrypted at rest
- Should have access controls

---

### Dead Letter Queue Lifecycle

**Creation:**

- Job fails permanently or exhausts retries
- Entry created in `DeadLetterJob` table
- Metric recorded

**User Actions:**

- **Retry:** User fixes issue, manually retries
- **Delete:** User cancels failed post
- **Ignore:** Post stays in dead letter queue

**Cleanup:**

- No automatic cleanup (user must act)
- Consider retention policy (e.g., 90 days)

---

## Trace Keys (Logs + Sentry + Metrics)

To make failures debuggable, logs/Sentry spans should consistently include:

- `correlationId`: end-to-end operation identifier (enqueue → publish)
- `publishAttemptId`: idempotency identifier for publish attempts
- `postId`, `userId`: domain identifiers
- `outboxEventId`, `eventType`: outbox identifiers
- `queueName`, `jobId`, `attemptsMade`: queue identifiers

These keys allow answering questions like:

- “Which publish attempt succeeded?” (`publishAttemptId`)
- “Did outbox enqueue fail or did the publish job fail?” (`outboxEventId` + `queueName`)
- “How many retries occurred?” (`attemptsMade` / outbox `attempts`)

---

## Error Classification

### Retryable Errors

**Network Errors:**

- `ETIMEDOUT` - Connection timeout
- `ECONNREFUSED` - Connection refused
- `EAI_AGAIN` - DNS resolution failure
- `ENOTFOUND` - Host not found

**HTTP Errors:**

- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout

**Pattern Matching:**

- Error message contains "timeout"
- Error message contains "network"
- Error message contains "connection"
- Error message contains "temporary"

---

### Non-Retryable Errors

**Validation Errors:**

- "not found" - Post doesn't exist
- "unauthorized" - Permission denied
- "forbidden" - Access denied
- "validation" - Invalid data
- "invalid" - Invalid format

**Business Logic Errors:**

- "already posted" - Post already published
- "already published" - Duplicate publish attempt

**Pattern Matching:**

- Error message contains "not found"
- Error message contains "unauthorized"
- Error message contains "forbidden"
- Error message contains "validation"
- Error message contains "invalid"
- Error message contains "already posted"
- Error message contains "already published"

---

## User-Facing Semantics

### "Why didn't my post publish?"

**Possible reasons:**

1. **Temporary failure** - Network issue, relay down
   - **What happened:** Retried 5 times, all failed
   - **What you can do:** Retry the post (it will try again)
   - **State:** `FAILED` → can transition to `SCHEDULED`

2. **Permanent failure** - Invalid signature, post deleted
   - **What happened:** Error detected, no retries attempted
   - **What you can do:** Fix the issue (re-sign, restore post) and retry
   - **State:** `FAILED` → must fix before retrying

3. **System issue** - Worker crashed, queue issue
   - **What happened:** Job never processed
   - **What you can do:** Contact support or wait for system recovery
   - **State:** May still be `SCHEDULED` (job in queue)

---

### "Can I revive a failed post?"

**Yes, with conditions:**

1. **If failure was temporary:**
   - Post is in `FAILED` state
   - Click "Retry" → transitions to `SCHEDULED`
   - Will attempt to publish again

2. **If failure was permanent:**
   - Post is in `FAILED` state
   - Must fix underlying issue first:
     - Re-sign event (if signature invalid)
     - Restore post (if deleted)
     - Fix configuration (if invalid)
   - Then click "Retry"

3. **If post is in dead letter queue:**
   - Can manually retry from admin interface
   - Or delete and create new post

---

### "Does analytics count failed posts?"

**No. Failed posts are not counted as published.**

**What's counted:**

- `PUBLISHED` state → counted as published
- `postedAt` timestamp set → counted as published

**What's not counted:**

- `FAILED` state → not counted
- `CANCELLED` state → not counted
- `DRAFT` state → not counted

**Metrics:**

- `postsPublished` - Only `PUBLISHED` posts
- `postsFailed` - Posts that reached `FAILED` state
- `postsScheduled` - Posts that were scheduled (regardless of outcome)

---

## Edge Cases

### Edge Case 1: Post Deleted During Publishing

**Scenario:** User deletes post while it's being published.

**Behavior:**

- Worker checks if post exists before publishing
- If post deleted → permanent failure
- No retries attempted
- Moves to dead letter queue

**State:** `PUBLISHING` → `FAILED` (immediately)

---

### Edge Case 2: User Edits Post During Publishing

**Scenario:** User edits scheduled post while it's being published.

**Behavior:**

- Original signed event is used (already in job)
- New edit creates new signed event
- Original publish may succeed or fail
- New edit creates new scheduled post

**State:**

- Original: `PUBLISHING` → `PUBLISHED` or `FAILED`
- New edit: `SCHEDULED` (new post)

**Note:** This is a race condition. Consider preventing edits during publishing.

---

### Edge Case 3: Worker Crashes Mid-Publish

**Scenario:** Worker crashes after starting publish but before completion.

**Behavior:**

- BullMQ will retry the job (if configured)
- Job retry will check idempotency
- If already published → skip (idempotency)
- If not published → retry publish

**State:** `PUBLISHING` → (crash) → retry → `PUBLISHED` or `FAILED`

---

### Edge Case 4: Relay Accepts But Doesn't Propagate

**Scenario:** Relay returns 200 OK but doesn't actually publish.

**Behavior:**

- We mark as `PUBLISHED` (relay said OK)
- But post may not appear on Nostr network
- No automatic detection (would require polling)

**State:** `PUBLISHED` (but may not be actually published)

**Mitigation:** Consider post-checker job to verify publication.

---

## Operational Guarantees

### What We Guarantee

1. **Temporary failures are retried** - Up to 5 attempts with exponential backoff
2. **Permanent failures are not retried** - Moved to dead letter queue immediately
3. **Failed posts can be revived** - User can retry after fixing issues
4. **Analytics are accurate** - Only `PUBLISHED` posts are counted

### What We Don't Guarantee

1. **100% delivery** - Network issues may prevent publishing
2. **Immediate failure detection** - Some failures may take time to detect
3. **Automatic recovery** - Permanent failures require user action

---

## Future Improvements

### Consider Adding

1. **Publish verification** - Check if post actually appeared on Nostr
2. **Smart retry** - Different retry strategies for different error types
3. **Failure notifications** - Alert users when posts fail
4. **Retry scheduling** - Allow users to schedule retries for later
5. **Failure analytics** - Track failure rates, common errors

---

## Revision History

- **2025-01-02**: Initial failure semantics document created
- **2026-01-19**: Documented outbox retry + dead-letter semantics and standardized trace keys

---

**This is a living document. Update it as failure handling evolves.**
