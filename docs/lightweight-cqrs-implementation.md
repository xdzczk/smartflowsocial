# Lightweight CQRS Implementation

## Overview

This document describes the lightweight CQRS (Command Query Responsibility Segregation)
implementation for SmartFlowSocial. This approach separates read and write models to provide fast
dashboard queries without impacting write performance.

## Architecture

### Write Model (Source of Truth)

- **Transactional tables**: `Post`, `LongFormPost` (existing tables)
- **Operations**: All writes go through transactional tables
- **Guarantees**: ACID transactions, data consistency

### Read Models (Optimized for Queries)

- **ScheduledPostRead**: Denormalized view of scheduled posts
- **PublishedPostRead**: Denormalized view of published posts
- **PostAnalyticsDaily**: Daily aggregation rollups (for future analytics)

### Event-Driven Updates

- **Outbox Pattern**: Read model updates are triggered via outbox events
- **Event Types**: `POST_CREATED`, `POST_UPDATED`, `POST_PUBLISHED`, `POST_DELETED`
- **Async Processing**: Read model updates don't block writes

## Implementation Details

### 1. Read Model Tables

#### ScheduledPostRead

```prisma
model ScheduledPostRead {
  id              String    @id
  userId          String
  postId          String    @unique
  caption         String?
  scheduledAtUtc  DateTime
  queueTypeName   String
  queueTypeColor  String?
  hashTagPresetId String?
  templateId      String?
  createdAt       DateTime
  updatedAt       DateTime

  @@index([userId, scheduledAtUtc])
  @@index([userId, queueTypeName])
}
```

#### PublishedPostRead

```prisma
model PublishedPostRead {
  id              String    @id
  userId          String
  postId          String    @unique
  caption         String?
  postedAt        DateTime
  queueTypeName   String
  queueTypeColor  String?
  engagementScore Int?
  createdAt       DateTime
  updatedAt       DateTime

  @@index([userId, postedAt])
  @@index([userId, queueTypeName])
  @@index([userId, postedAt, engagementScore])
}
```

### 2. Event Flow

1. **Post Created**: `createPostWithOutbox()` emits `POST_CREATED` event
2. **Post Updated**: `updatePost()` emits `POST_UPDATED` event
3. **Post Published**: `updatePostStatus()` emits `POST_PUBLISHED` event (when `isPosted` changes
   from false to true)
4. **Post Deleted**: `deletePost()` emits `POST_DELETED` event

### 3. Read Model Worker

The read model worker (`app/infra/outbox/read-model-worker.server.ts`) processes outbox events and
updates read models:

- **POST_CREATED/POST_UPDATED**: Updates `ScheduledPostRead` if post is scheduled
- **POST_PUBLISHED**: Moves post from `ScheduledPostRead` to `PublishedPostRead`
- **POST_DELETED**: Removes post from both read models

### 4. Query Functions

New query functions in `app/models/post.read-queries.server.ts`:

- `getScheduledPostsFromReadModel()`: Fast scheduled posts query
- `getPublishedPostsFromReadModel()`: Fast published posts query with pagination
- `getPostStatisticsFromReadModel()`: Fast statistics query
- `areReadModelsPopulated()`: Check if read models are ready

### 5. Fallback Strategy

Read model queries include a fallback to transactional tables:

- If read model is empty, query transactional table
- Ensures backward compatibility during migration
- Can be disabled once read models are populated

## Migration Steps

### 1. Run Database Migration

```bash
npx prisma migrate dev
```

This creates the read model tables.

### 2. Backfill Existing Data

```bash
npx tsx scripts/backfill-read-models.ts
```

This populates read models from existing transactional data.

### 3. Deploy Code

Deploy the updated code that:

- Emits read model events
- Processes events via outbox worker
- Uses read model queries (with fallback)

### 4. Monitor

- Check that read models are being updated
- Verify dashboard queries are using read models
- Monitor for any errors in read model updates

## Usage

### Using Read Model Queries

```typescript
// In dashboard loader
import { getScheduledPostsFromReadModel } from "~/models/post.read-queries.server";

const posts = await getScheduledPostsFromReadModel({
  userId,
  queueType: "all",
  useFallback: true, // Falls back to transactional table if read model empty
});
```

### Gradual Migration

1. **Phase 1**: Deploy with fallback enabled (current)
2. **Phase 2**: Monitor read model population
3. **Phase 3**: Disable fallback once read models are populated
4. **Phase 4**: Remove fallback code (optional)

## Benefits

1. **Fast Dashboard Queries**: Denormalized tables optimized for reads
2. **No Write Impact**: Read model updates are async
3. **Scalable**: Dashboards don't slow down as data grows
4. **Future-Proof**: Easy to add analytics rollups
5. **Simple**: Extends existing outbox pattern

## Monitoring

### Metrics to Track

- Read model update latency
- Read model update errors
- Read model population status
- Dashboard query performance

### Logging

Read model updates are logged with correlation IDs for tracing.

## Future Enhancements

1. **Analytics Rollups**: Use `PostAnalyticsDaily` for daily aggregations
2. **Longform Posts**: Add read models for longform posts
3. **Caching**: Add Redis caching layer for frequently accessed data
4. **Real-time Updates**: WebSocket updates for dashboard changes

## Troubleshooting

### Read Models Not Updating

1. Check outbox worker is running
2. Check for errors in outbox event processing
3. Verify events are being emitted
4. Check read model worker logs

### Dashboard Queries Slow

1. Verify read models are populated
2. Check indexes are being used
3. Consider adding more indexes
4. Check if fallback is being used (shouldn't be after migration)

### Data Inconsistencies

1. Read models are eventually consistent (async updates)
2. For critical reads, use transactional tables
3. Re-run backfill script if needed

## Files Modified/Created

### New Files

- `app/infra/outbox/read-model-worker.server.ts` - Read model update logic
- `app/models/post.read-queries.server.ts` - Read model query functions
- `scripts/backfill-read-models.ts` - Backfill script
- `prisma/migrations/20250103000000_add_read_models/migration.sql` - Migration

### Modified Files

- `app/infra/outbox/outbox.server.ts` - Added read model event types
- `app/infra/outbox/outbox-worker.server.ts` - Integrated read model updates
- `app/models/post.commands.server.ts` - Emit read model events
- `prisma/schema.prisma` - Added read model tables
- `app/features/posts/queues.server.ts` - Pass correlationId to updatePostStatus
- `app/features/posts/use-cases/publish-now.use-case.server.ts` - Pass correlationId

## Success Criteria

✅ Read model tables created ✅ Events emitted on post create/update/publish/delete ✅ Read model
worker processes events ✅ Backfill script populates existing data ✅ Dashboard queries use read
models (with fallback) ✅ No performance degradation on writes
