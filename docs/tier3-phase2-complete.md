# Tier 3 Phase 2: Advanced Retry Strategies - ✅ COMPLETE

## Summary

Phase 2 of Tier 3 improvements is **complete**. The system now has sophisticated retry strategies with exponential backoff, configurable policies per job type, and a dead letter queue for permanently failed jobs.

## What Was Completed

### 1. Retry Policy Service ✅

**New File:** `app/infra/queue/retry-policy.server.ts`

**Features:**
- Configurable retry policies per queue type
- Exponential backoff with configurable multiplier
- Jitter to prevent thundering herd problem
- Retryable vs non-retryable error classification
- BullMQ retry configuration generation

**Policies:**
- `scheduled-posts`: 5 attempts, 2s base delay, 60s max, ±15% jitter
- `scheduled-longform-posts`: 5 attempts, 2s base delay, 60s max, ±15% jitter
- `post-checker`: 2 attempts, 5s base delay, 30s max, ±10% jitter

**Functions:**
- `getRetryPolicy(queueType)` - Get policy for queue type
- `calculateRetryDelay(attempt, policy)` - Calculate delay with jitter
- `shouldRetry(attempt, policy)` - Check if should retry
- `isRetryableError(error)` - Classify retryable errors
- `getBullMQRetryConfig(queueType)` - Generate BullMQ config

### 2. Dead Letter Queue Service ✅

**New File:** `app/infra/queue/dead-letter-queue.server.ts`

**Database Model:** `DeadLetterJob` in `prisma/schema.prisma`

**Features:**
- Store permanently failed jobs in database
- Query and retrieve dead letter entries
- Manual retry capability
- Statistics and error aggregation
- Correlation ID tracking

**Functions:**
- `createDeadLetterEntry()` - Store failed job
- `getDeadLetterEntries()` - Query entries
- `retryDeadLetterJob()` - Manually retry a job
- `deleteDeadLetterEntry()` - Remove entry
- `getDeadLetterStats()` - Get statistics

**Database Schema:**
```prisma
model DeadLetterJob {
  id            String   @id @default(cuid())
  queueType     String
  jobId         String
  jobName       String
  jobData       Json
  error         String
  errorStack    String?
  attemptsMade  Int
  correlationId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([queueType, createdAt])
  @@index([correlationId])
  @@index([jobId])
}
```

### 3. Integration with Queue System ✅

**Updated:** `app/infra/queue/queue-client.server.ts`
- Queue creation now uses retry policies
- `removeOnFail: false` to keep failed jobs for dead letter queue
- Automatic retry configuration from policies

**Updated:** `app/features/posts/queues.server.ts`
- Error handling checks retry eligibility
- Moves jobs to dead letter queue when retries exhausted
- Logs retry attempts and decisions
- Integrates with retry policy service

**Updated:** `app/lib/queue-metrics.server.ts`
- Added `deadLetterCounter` metric
- Tracks jobs moved to dead letter queue by queue type and error type

### 4. Retry Logic Flow ✅

**Retry Decision:**
1. Job fails
2. Check `shouldRetry(attemptsMade, policy)` - has attempts left?
3. Check `isRetryableError(error)` - is error retryable?
4. If both true → BullMQ retries with exponential backoff
5. If either false → Move to dead letter queue

**Exponential Backoff:**
- Attempt 1: ~2s (with jitter)
- Attempt 2: ~4s (with jitter)
- Attempt 3: ~8s (with jitter)
- Attempt 4: ~16s (with jitter)
- Attempt 5: ~32s (with jitter, capped at maxDelay)

**Jitter:**
- Prevents thundering herd when many jobs retry simultaneously
- Adds random variation (±10-15%) to delay
- Example: 2s base → 1.7s to 2.3s with ±15% jitter

### 5. Error Classification ✅

**Non-Retryable Errors:**
- "not found" - Post/user doesn't exist
- "unauthorized" - Permission denied
- "forbidden" - Access denied
- "validation" - Invalid input
- "invalid" - Invalid data
- "already posted" - Duplicate operation
- "already published" - Already completed

**Retryable Errors:**
- "timeout" - Network timeout
- "network" - Network issues
- "connection" - Connection problems
- "econnrefused" - Connection refused
- "etimedout" - Timeout error
- "temporary" - Temporary failures
- "503", "502", "504" - Server errors

## How It Works

### Retry Flow

```
Job Fails
  ↓
Check attemptsMade < maxAttempts?
  ↓ (if yes)
Check isRetryableError(error)?
  ↓ (if yes)
Calculate retry delay (exponential + jitter)
  ↓
BullMQ schedules retry
  ↓
Job retries after delay
  ↓
If still fails, repeat until maxAttempts
  ↓
If maxAttempts reached or non-retryable error
  ↓
Move to Dead Letter Queue
```

### Dead Letter Queue Flow

```
Job Exhausts Retries
  ↓
createDeadLetterEntry()
  ↓
Store in Database (DeadLetterJob)
  ↓
Record Metric (deadLetterCounter)
  ↓
Log Warning
  ↓
Job Available for Manual Review/Retry
```

## Files Created

1. `app/infra/queue/retry-policy.server.ts` - Retry policy service
2. `app/infra/queue/dead-letter-queue.server.ts` - Dead letter queue service

## Files Modified

1. `prisma/schema.prisma` - Added DeadLetterJob model
2. `app/infra/queue/queue-client.server.ts` - Added retry configuration
3. `app/features/posts/queues.server.ts` - Added retry and dead letter handling
4. `app/lib/queue-metrics.server.ts` - Added dead letter metrics

## Configuration Examples

### Retry Policy Configuration

```typescript
// scheduled-posts queue
{
  maxAttempts: 5,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  multiplier: 2,
  useJitter: true,
  jitterFactor: 0.15
}
```

### Retry Delay Calculation

```typescript
// Attempt 1: 2000ms * 2^0 = 2000ms ±15% = 1700-2300ms
// Attempt 2: 2000ms * 2^1 = 4000ms ±15% = 3400-4600ms
// Attempt 3: 2000ms * 2^2 = 8000ms ±15% = 6800-9200ms
// Attempt 4: 2000ms * 2^3 = 16000ms ±15% = 13600-18400ms
// Attempt 5: 2000ms * 2^4 = 32000ms ±15% = 27200-36800ms (capped at 60000ms)
```

## Benefits Achieved

1. **Resilience**: Automatic retries for transient failures
2. **Efficiency**: Exponential backoff prevents overwhelming services
3. **Stability**: Jitter prevents thundering herd
4. **Observability**: Dead letter queue for debugging failed jobs
5. **Flexibility**: Configurable policies per job type
6. **Recovery**: Manual retry capability for dead letter jobs

## Monitoring

### Metrics

- `queue_dead_letter_total` - Jobs moved to dead letter queue
  - Labels: `queue`, `error_type`
- `queue_job_retries_total` - Total retries (existing)
- `queue_job_failed_total` - Failed jobs (existing)

### Dead Letter Queue Queries

```typescript
// Get all dead letter entries
const entries = await getDeadLetterEntries();

// Get entries for specific queue
const postEntries = await getDeadLetterEntries("scheduled-posts");

// Get statistics
const stats = await getDeadLetterStats();
// Returns: { total, byQueueType, recentErrors }

// Retry a job
await retryDeadLetterJob(entryId);

// Delete an entry
await deleteDeadLetterEntry(entryId);
```

## Testing Recommendations

1. **Test Retry Logic:**
   - Simulate transient failures (network timeout)
   - Verify exponential backoff delays
   - Verify jitter variation
   - Verify max attempts respected

2. **Test Error Classification:**
   - Non-retryable errors → immediate dead letter
   - Retryable errors → retry with backoff
   - Verify classification logic

3. **Test Dead Letter Queue:**
   - Verify jobs moved after max attempts
   - Test manual retry functionality
   - Test statistics and queries
   - Test cleanup/deletion

4. **Test Metrics:**
   - Verify dead letter counter increments
   - Verify metrics include correct labels
   - Test metric aggregation

## Next Steps

Phase 2 is complete. Next phases:

- **Phase 3**: Database Constraints
- **Phase 4**: Recurring/Recycling Model
- **Phase 5**: Enhanced Error Handling

## Status: ✅ **PHASE 2 COMPLETE**

Advanced retry strategies are fully implemented with exponential backoff, jitter, configurable policies, and dead letter queue support. The system can now handle transient failures gracefully and provide visibility into permanently failed jobs.
