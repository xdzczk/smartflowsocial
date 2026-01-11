# Tier 1 Implementation Status

## ✅ Completed

### 1. Schema Migration (#6)
- ✅ Added `scheduledAtUtc DateTime?` to `Post` model
- ✅ Added `scheduledAtUtc DateTime?` to `LongFormPost` model
- ✅ Added indexes for `scheduledAtUtc` queries
- ✅ Added `currentState` field to Post for state machine
- ✅ Added `PostStateTransition` model for audit trail
- ✅ Added idempotency key fields (`creationIdempotencyKey`, `enqueueIdempotencyKey`)

### 2. Outbox Pattern (#5)
- ✅ Added `OutboxEvent` model to schema
- ✅ Created `app/infra/outbox/outbox.server.ts` with outbox service
- ✅ Created `app/infra/outbox/outbox-worker.server.ts` to drain events
- ✅ Integrated outbox worker into `worker.ts`
- ✅ Created `createPostWithOutbox()` function for transactional post creation

### 3. Use-Case Layer (#2)
- ✅ Created `app/features/posts/use-cases/types.ts` with interfaces
- ✅ Created `CreatePostUseCase` class
- ✅ Created `PublishNowUseCase` class
- ✅ Created `SchedulePostUseCase` class

### 4. State Machine (#3)
- ✅ Created `app/features/posts/state-machine/post-state.ts` with state definitions
- ✅ Created `app/features/posts/state-machine/post-state-machine.server.ts` service
- ✅ Integrated state machine into queue worker
- ✅ Integrated state machine into use cases

### 5. Idempotency (#4)
- ✅ Created `app/lib/idempotency.server.ts` with key generation functions
- ✅ Added idempotency key fields to schema
- ✅ Integrated idempotency checks in `CreatePostUseCase`
- ✅ Integrated idempotency keys in outbox events

### 6. Dual-Write Support
- ✅ Updated `createPost()` to write to both `scheduledFor` and `scheduledAtUtc`
- ✅ Updated `reschedulePost()` to support dual-write
- ✅ Updated `updatePost()` to support dual-write
- ✅ Created data migration script: `scripts/migrate-scheduled-for.ts`

## 🔄 Next Steps

### 1. Database Migration
Run Prisma migration to apply schema changes:
```bash
npx prisma migrate dev --name add_tier1_improvements
```

### 2. Run Data Migration
After deploying the schema, run the data migration:
```bash
npx tsx scripts/migrate-scheduled-for.ts
```

### 3. Update Queries
Update query functions to use `scheduledAtUtc` instead of `scheduledFor`:
- `app/models/post.queries.server.ts` - `getScheduledPosts()`
- `app/models/longformpost.server.ts` - `getScheduledLongFormPosts()`
- Any other queries that filter/sort by `scheduledFor`

### 4. Integrate Use Cases
Update action handlers to use use cases:
- `app/features/posts/services/newpost-action.server.ts`
- `app/features/posts/services/scheduled-posts.server.ts`
- `app/features/posts/bulkposts.action.server.ts`

### 5. Testing
- Test outbox pattern with transaction rollback scenarios
- Test state machine transitions
- Test idempotency key generation and checks
- Test dual-write period (both fields populated)

## 📝 Notes

### TypeScript Errors
The linting errors in `outbox.server.ts` are expected until:
1. Prisma migration is run
2. Prisma client is regenerated
3. TypeScript server is restarted

These will resolve after the migration is applied.

### Migration Strategy
1. **Phase 1 (Current)**: Dual-write period - both `scheduledFor` and `scheduledAtUtc` are populated
2. **Phase 2**: Update all queries to use `scheduledAtUtc`
3. **Phase 3**: Remove `scheduledFor` field (after monitoring for 1-2 weeks)

### Outbox Worker
The outbox worker runs every 5 seconds and processes up to 50 events per batch. It's integrated into the main worker process and will automatically start when the worker starts.

### State Machine States
- `DRAFT` - Initial state for unscheduled posts
- `SCHEDULED` - Post is scheduled for future publication
- `PUBLISHING` - Post is currently being published
- `PUBLISHED` - Post successfully published (terminal)
- `FAILED` - Publication failed (can retry)
- `CANCELLED` - Post cancelled (terminal)
