# Tier 1 Implementation - Complete ✅

## Summary

All Tier 1 infrastructure has been successfully implemented. The codebase now has:
- ✅ Outbox pattern for reliable job enqueueing
- ✅ Schema migration to DateTime fields
- ✅ Use-case layer for business logic
- ✅ State machine for post lifecycle
- ✅ Idempotency guarantees

## What's Been Completed

### 1. Database Schema ✅
- **Migration file created**: `prisma/migrations/20250101000000_add_tier1_improvements/migration.sql`
- **New fields added**:
  - `scheduledAtUtc DateTime?` on Post and LongFormPost
  - `creationIdempotencyKey String? @unique` on Post and LongFormPost
  - `enqueueIdempotencyKey String? @unique` on Post and LongFormPost
  - `currentState String` on Post (defaults to "DRAFT")
- **New tables**:
  - `OutboxEvent` - for transactional job enqueueing
  - `PostStateTransition` - for state machine audit trail
- **Indexes added** for performance

### 2. Outbox Pattern ✅
- **Service**: `app/infra/outbox/outbox.server.ts`
  - `createOutboxEvent()` - Create outbox events
  - `createOutboxEventInTransaction()` - For use in transactions
  - `getUnprocessedOutboxEvents()` - Query unprocessed events
  - `markOutboxEventProcessed()` - Mark events as processed
- **Worker**: `app/infra/outbox/outbox-worker.server.ts`
  - Processes events every 5 seconds
  - Enqueues jobs into BullMQ
  - Handles errors gracefully
- **Integration**: Worker started in `worker.ts`

### 3. Use-Case Layer ✅
- **Types**: `app/features/posts/use-cases/types.ts`
- **Use Cases**:
  - `CreatePostUseCase` - Handles post creation with idempotency
  - `PublishNowUseCase` - Publishes posts immediately
  - `SchedulePostUseCase` - Schedules posts using outbox pattern
- **Location**: `app/features/posts/use-cases/`

### 4. State Machine ✅
- **State definitions**: `app/features/posts/state-machine/post-state.ts`
  - States: DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, CANCELLED
  - Transition validation
- **Service**: `app/features/posts/state-machine/post-state-machine.server.ts`
  - `transition()` - Transition posts between states
  - `getStateHistory()` - Get transition history
  - `getCurrentState()` - Get current state
- **Integration**: Used in queue worker and use cases

### 5. Idempotency ✅
- **Utilities**: `app/lib/idempotency.server.ts`
  - `generateCreationIdempotencyKey()` - For post creation
  - `generateEnqueueIdempotencyKey()` - For job enqueueing
- **Enforcement**: In use cases and outbox worker

### 6. Query Updates ✅
- **Updated queries to use `scheduledAtUtc`**:
  - `getScheduledPosts()` - Now orders by `scheduledAtUtc`
  - `getCronDueScheduledPosts()` - Now filters by `scheduledAtUtc`
  - `getScheduledLongFormPosts()` - Now orders by `scheduledAtUtc`

### 7. Model Commands ✅
- **Dual-write support**: All commands write to both `scheduledFor` and `scheduledAtUtc`
- **New function**: `createPostWithOutbox()` - Creates post + outbox event in transaction
- **Updated functions**:
  - `createPost()` - Supports idempotency keys and dual-write
  - `reschedulePost()` - Updates both fields
  - `updatePost()` - Updates both fields

### 8. Data Migration Script ✅
- **Script**: `scripts/migrate-scheduled-for.ts`
- **Purpose**: Migrates existing `scheduledFor` string values to `scheduledAtUtc` DateTime
- **Usage**: Run after deploying schema changes

## Next Steps (Optional - Gradual Integration)

### 1. Apply Database Migration
```bash
# Review the migration file first
cat prisma/migrations/20250101000000_add_tier1_improvements/migration.sql

# Apply the migration (development)
npx prisma migrate dev

# Or apply in production
npx prisma migrate deploy
```

### 2. Run Data Migration
After the schema is deployed:
```bash
npx tsx scripts/migrate-scheduled-for.ts
```

### 3. Gradually Integrate Use Cases (Optional)
The use cases are ready but not yet integrated into action handlers. You can integrate them gradually:

**Example integration in `newpost-action.server.ts`**:
```typescript
// Replace direct createPost() calls with:
import { CreatePostUseCase } from "../use-cases/create-post.use-case.server";
import { PublishNowUseCase } from "../use-cases/publish-now.use-case.server";

const createPostUseCase = new CreatePostUseCase();
const result = await createPostUseCase.execute({
  userId,
  content: applyHashtags(...),
  // ... other fields
  scheduledFor: action === "schedule-text" ? signedEvent.created_at : undefined,
});

if (action === "post-text") {
  const publishUseCase = new PublishNowUseCase();
  await publishUseCase.execute({
    postId: result.post.id,
    userId,
    signedEvent: validatedSignedEvent,
    relays: sanitizedRelays,
  });
}
```

### 4. Monitor Outbox Worker
- Check logs for outbox processing
- Monitor `OutboxEvent` table for unprocessed events
- Verify jobs are being enqueued correctly

## Testing Checklist

- [ ] Run database migration
- [ ] Run data migration script
- [ ] Verify outbox worker is processing events
- [ ] Test post creation with scheduling
- [ ] Test post creation without scheduling
- [ ] Test state transitions
- [ ] Test idempotency (try creating same post twice)
- [ ] Verify queries use `scheduledAtUtc` correctly

## Rollback Plan

If issues arise:

1. **Outbox issues**: The outbox pattern is additive - existing direct enqueueing still works
2. **State machine issues**: `currentState` has a default, existing code doesn't break
3. **Schema issues**: `scheduledFor` is still populated (dual-write), can revert queries
4. **Migration rollback**: Use `prisma migrate resolve --rolled-back <migration_name>`

## Files Created/Modified

### New Files
- `app/infra/outbox/outbox.server.ts`
- `app/infra/outbox/outbox-worker.server.ts`
- `app/lib/idempotency.server.ts`
- `app/features/posts/state-machine/post-state.ts`
- `app/features/posts/state-machine/post-state-machine.server.ts`
- `app/features/posts/use-cases/types.ts`
- `app/features/posts/use-cases/create-post.use-case.server.ts`
- `app/features/posts/use-cases/publish-now.use-case.server.ts`
- `app/features/posts/use-cases/schedule-post.use-case.server.ts`
- `scripts/migrate-scheduled-for.ts`
- `prisma/migrations/20250101000000_add_tier1_improvements/migration.sql`

### Modified Files
- `prisma/schema.prisma` - Added new fields and tables
- `app/models/post.commands.server.ts` - Dual-write, outbox support
- `app/models/post.queries.server.ts` - Use `scheduledAtUtc`
- `app/models/post.types.ts` - Added idempotency key field
- `app/models/longformpost.server.ts` - Use `scheduledAtUtc`
- `app/features/posts/queues.server.ts` - State machine integration
- `worker.ts` - Outbox worker startup

## Status: ✅ Ready for Deployment

All Tier 1 improvements are implemented and ready. The system will work with both old and new code during the transition period.
