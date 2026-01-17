# User-Facing Guarantees

**Last Updated:** 2025-01-02  
**Status:** Active

This document defines the operational promises SmartFlowSocial makes to users about how the system
behaves.

---

## Core Guarantees

### 1. Exactly-Once Publishing

**Promise:** "If I schedule a post, it will publish exactly once (not zero times, not twice)."

**What this means:**

- Post will attempt to publish at scheduled time
- If successful → published once
- If failed → not published (can retry)
- Idempotency prevents duplicate publishes

**Edge cases:**

- **Worker crash:** Job retries, but idempotency prevents duplicate publish
- **Network blip:** Retries up to 5 times, but only one successful publish
- **Race condition:** Idempotency keys prevent double-publish

**What we cannot guarantee:**

- 100% delivery (network issues may prevent publishing)
- Immediate publishing (may be delayed by retries)

**How we achieve it:**

- Idempotency keys (`enqueueIdempotencyKey`) prevent duplicate job enqueueing
- State machine prevents invalid transitions
- Database constraints prevent duplicate publishes

---

### 2. Edit Behavior

**Promise:** "If I edit a scheduled post, the edited version will be published (not the original)."

**What this means:**

- Editing a scheduled post creates a new signed event
- Original scheduled job is cancelled
- New scheduled job is created with edited content
- New version will be published

**Timing matters:**

- **Edit before scheduled time:** New version scheduled, old version cancelled
- **Edit during publishing:** Race condition (see edge cases below)
- **Edit after publishing:** Post already published, edit creates new post

**Edge cases:**

- **Edit 2 minutes before publish:** New version wins (old job cancelled)
- **Edit during publishing:** Original may publish, new version also scheduled
- **Edit after publish started:** Original publishes, new version creates separate post

**How we achieve it:**

- `cancelScheduledPost()` cancels original job
- New `SchedulePostUseCase` creates new job
- State machine tracks transitions

---

### 3. Downtime Handling

**Promise:** "If the app is down, scheduled posts will still publish (when app comes back)."

**What this means:**

- Scheduled posts are stored in database (persistent)
- Jobs are stored in Redis/BullMQ (persistent)
- When app restarts, workers resume processing
- Posts scheduled during downtime will publish when app recovers

**What happens:**

1. **App goes down** → Workers stop processing
2. **Posts scheduled** → Stored in database, jobs in queue
3. **App comes back** → Workers resume, process backlog
4. **Posts publish** → May be delayed, but will publish

**Delays:**

- Posts scheduled during downtime will be delayed
- Posts scheduled before downtime will publish when app recovers
- No posts are lost (they're in the queue)

**What we cannot guarantee:**

- Exact timing (may be delayed by downtime duration)
- Immediate recovery (may take time to process backlog)

**How we achieve it:**

- Database persistence (posts stored in DB)
- Queue persistence (BullMQ with Redis)
- Worker recovery (workers resume on restart)

---

### 4. Relay Failure Handling

**Promise:** "If a relay is down, we retry other relays (up to 5 times)."

**What this means:**

- We publish to multiple relays (user's configured relays)
- If one relay fails, we try others
- We retry failed relays up to 5 times
- If all relays fail, post moves to failed state

**Retry strategy:**

- Exponential backoff (2s → 4s → 8s → 16s → 32s)
- Jitter to prevent thundering herd
- Health-aware routing (prioritize healthy relays)

**What happens:**

1. **Relay fails** → Mark as unhealthy, try next relay
2. **All relays fail** → Retry with exponential backoff
3. **Retries exhausted** → Post moves to `FAILED` state
4. **User can retry** → Manually retry after fixing relay issues

**What we cannot guarantee:**

- All relays will be available
- Post will publish if all relays are down
- Immediate relay recovery detection

**How we achieve it:**

- Relay health tracking
- Prioritized relay routing
- Retry policy with exponential backoff
- Dead letter queue for permanent failures

---

## State Guarantees

### Draft Posts

**Guarantee:** "Drafts are private and never published until I schedule them."

**What this means:**

- Drafts are stored in database only
- Never sent to Nostr relays
- Never appear on Nostr network
- Can be edited, scheduled, or deleted

**State:** `DRAFT` → never transitions to `PUBLISHED` without user action

---

### Scheduled Posts

**Guarantee:** "Scheduled posts will attempt to publish at the scheduled time."

**What this means:**

- Post is scheduled for specific time
- System will attempt to publish at that time
- May be delayed by retries or system issues
- Will eventually publish (or fail and be retryable)

**State:** `SCHEDULED` → `PUBLISHING` → `PUBLISHED` or `FAILED`

---

### Published Posts

**Guarantee:** "Published posts have been sent to Nostr relays (but we cannot guarantee they
appeared on the network)."

**What this means:**

- Post was successfully sent to at least one relay
- Relay returned success response
- Post should appear on Nostr network
- We cannot verify it actually appeared (would require polling)

**State:** `PUBLISHED` (terminal state)

**Note:** We mark as published when relay accepts, but cannot verify network propagation.

---

### Failed Posts

**Guarantee:** "Failed posts did not publish and can be retried."

**What this means:**

- Post failed to publish (all retries exhausted or permanent failure)
- Post did not appear on Nostr network
- User can retry (if temporary failure) or fix and retry (if permanent failure)
- Post is in `FAILED` state

**State:** `FAILED` → can transition to `SCHEDULED` (if user retries)

---

## Timing Guarantees

### Scheduled Time

**Guarantee:** "Posts are scheduled for the time you specify (in your timezone)."

**What this means:**

- You specify time in your configured timezone
- System converts to UTC for storage
- Post attempts to publish at that UTC time
- Timezone conversions use Temporal API (accurate)

**Edge cases:**

- **DST transitions:** Handled correctly by Temporal
- **Timezone changes:** If you change timezone, existing scheduled posts keep original time
- **Clock drift:** System clock should be synchronized (NTP)

**What we cannot guarantee:**

- Exact millisecond precision (may be ±1 second)
- System clock accuracy (depends on server time sync)

---

### Retry Timing

**Guarantee:** "Failed posts are retried with exponential backoff (not immediately)."

**What this means:**

- First retry: ~2 seconds after failure
- Second retry: ~4 seconds after first retry
- Third retry: ~8 seconds after second retry
- And so on (up to 5 attempts)

**Total time:** ~30 seconds if all retries fail

**Jitter:** ±15% random variation to prevent thundering herd

---

## Data Guarantees

### Privacy

**Guarantee:** "Drafts and scheduled posts are private until published."

**What this means:**

- Drafts never leave our database
- Scheduled posts never sent to relays until publish time
- Only published posts are sent to Nostr network
- We don't share your data with third parties (except Nostr relays when publishing)

**See:** [Threat Model](./threat-model.md) for detailed privacy information.

---

### Persistence

**Guarantee:** "Your posts are stored persistently and survive system restarts."

**What this means:**

- Posts stored in PostgreSQL (persistent database)
- Jobs stored in Redis/BullMQ (persistent queue)
- State transitions recorded in database
- Nothing is lost on system restart

**What we cannot guarantee:**

- Database backups (depends on backup strategy)
- Queue persistence if Redis fails (depends on Redis persistence)

---

## Operational Guarantees

### Availability

**Guarantee:** "The system attempts to be available, but scheduled posts will publish even if the
web app is down."

**What this means:**

- Web app and worker processes are separate
- Workers can run independently
- Scheduled posts publish even if web app is down
- Web app downtime doesn't affect publishing

**What we cannot guarantee:**

- 100% uptime (depends on infrastructure)
- Immediate response times (may be delayed during high load)

---

### Performance

**Guarantee:** "Posts are published within seconds of scheduled time (may be delayed by retries)."

**What this means:**

- Posts attempt to publish at scheduled time
- May be delayed by network issues or retries
- Typically publishes within 1-2 seconds of scheduled time
- Retries may add up to ~30 seconds if all fail

**What we cannot guarantee:**

- Exact millisecond precision
- No delays (network issues may cause delays)

---

## What We Don't Guarantee

### We Don't Guarantee

1. **100% delivery** - Network issues may prevent publishing
2. **Immediate publishing** - May be delayed by retries or system issues
3. **Network propagation** - We send to relays, but cannot verify network propagation
4. **Relay availability** - We cannot guarantee relays will be available
5. **Exact timing** - May be ±1 second due to system clock and processing time
6. **Data recovery** - Depends on backup strategy (not guaranteed by default)

---

## How to Verify Guarantees

### Check if Post Published

1. **Check post state:** Should be `PUBLISHED`
2. **Check `postedAt` timestamp:** Should be set
3. **Check Nostr network:** Search for your post on Nostr clients
4. **Check relay logs:** (if you have access)

### Check if Post Failed

1. **Check post state:** Should be `FAILED`
2. **Check error message:** See why it failed
3. **Check dead letter queue:** (if applicable)
4. **Retry post:** If temporary failure, can retry

### Check Scheduled Time

1. **Check `scheduledAtUtc`:** UTC timestamp in database
2. **Convert to your timezone:** Use timezone conversion
3. **Check state transitions:** See when post was scheduled

---

## Support

If you experience issues that violate these guarantees:

1. **Check post state** - See what state the post is in
2. **Check error messages** - See why it failed
3. **Check logs** - (if you have access) See system logs
4. **Contact support** - Report the issue with post ID and correlation ID

---

## Revision History

- **2025-01-02**: Initial user-facing guarantees document created

---

**This is a living document. Update it as guarantees evolve.**
