# Tier 2 Progress Update

## Phase 1: Enhanced Observability - ✅ **COMPLETE**

### Completed Items

1. **Correlation Context Utility** ✅
   - Created `app/lib/correlation-context.server.ts`
   - Functions: `getCorrelationId()`, `createCorrelationContext()`, `extractCorrelationId()`

2. **Schema Updates** ✅
   - Added `correlationId String?` to `OutboxEvent` model
   - Added index on `correlationId` for tracing
   - Prisma client regenerated

3. **Use Cases** ✅
   - `CreatePostUseCase` - Uses correlation IDs, logs operations
   - `SchedulePostUseCase` - Uses correlation IDs, logs operations
   - `PublishNowUseCase` - Uses correlation IDs, passes to fetch
   - All use case input types include `correlationId?: string`

4. **Outbox Pattern** ✅
   - `createOutboxEvent()` accepts `correlationId`
   - `createOutboxEventInTransaction()` accepts `correlationId`
   - Payload types include `correlationId`
   - Outbox worker preserves correlation IDs in job payloads

5. **Queue System** ✅
   - `PostJobData` and `LongFormPostJobData` include `correlationId`
   - Queue workers extract correlation IDs from job data
   - Correlation IDs passed to `fetchWithRetry` for HTTP requests
   - All queue worker logs include correlation IDs

6. **Action Handlers** ✅
   - `handleNewPostAction` extracts correlation ID from request headers
   - All handler functions accept and pass correlation IDs
   - Correlation IDs flow: Request → Handler → Use Case → Outbox → Queue → Worker

7. **Error Logging** ✅
   - `LogContext` interface includes `correlationId`
   - All error logs include correlation IDs when available
   - Sentry integration includes correlation IDs in tags and extra data
   - Development logs show correlation IDs

### Files Modified

**New Files:**
- `app/lib/correlation-context.server.ts`

**Schema:**
- `prisma/schema.prisma` - Added correlationId to OutboxEvent

**Use Cases:**
- `app/features/posts/use-cases/types.ts`
- `app/features/posts/use-cases/create-post.use-case.server.ts`
- `app/features/posts/use-cases/schedule-post.use-case.server.ts`
- `app/features/posts/use-cases/publish-now.use-case.server.ts`

**Infrastructure:**
- `app/infra/outbox/outbox.server.ts`
- `app/infra/outbox/outbox-worker.server.ts`
- `app/infra/queue/queue-types.ts`

**Models:**
- `app/models/post.commands.server.ts`

**Workers:**
- `app/features/posts/queues.server.ts`

**Handlers:**
- `app/features/posts/services/newpost-action.server.ts`

**Logging:**
- `app/lib/error-logger.server.ts`

### Correlation ID Flow

```
HTTP Request (with X-Correlation-Id header)
  ↓
Action Handler (extracts correlation ID)
  ↓
Use Case (uses correlation ID, logs operations)
  ↓
Outbox Event (stores correlation ID)
  ↓
Outbox Worker (preserves correlation ID in job)
  ↓
Queue Job (includes correlation ID in data)
  ↓
Queue Worker (extracts correlation ID, uses in fetch/logs)
  ↓
All Logs (include correlation ID for tracing)
```

### Next Steps

1. **Business Metrics Collection** (Phase 4)
   - Track posts created, published, failed
   - Track state transitions
   - Track outbox events processed

2. **Relay Health Monitoring** (Phase 2)
   - Track relay availability
   - Implement adaptive routing
   - Add circuit breaker pattern

3. **Port/Adapter Boundaries** (Phase 3)
   - Create publisher interface
   - Create relay interface
   - Refactor existing code

4. **Performance Metrics** (Phase 4)
   - Publish latency
   - Queue processing time
   - Outbox processing time

## Status: Phase 1 Complete ✅

All correlation ID infrastructure is in place. The system now has end-to-end request tracking through correlation IDs.
