# Database Optimization Migration Guide

**Date**: 2025-12-26

## Overview

This document describes the database query optimizations implemented to improve performance and prevent N+1 query problems.

## Changes Made

### 1. Database Indexes Added

New indexes have been added to the Prisma schema to optimize common query patterns:

#### Post Model Indexes
- `@@index([userId, isScheduled, isPosted])` - For scheduled posts queries
- `@@index([userId, isPosted])` - For posted posts queries
- `@@index([userId, draft])` - For draft posts queries
- `@@index([isScheduled, scheduledFor])` - For cron job queries
- `@@index([userId, scheduledFor])` - For user-specific scheduled posts

#### LongFormPost Model Indexes
- `@@index([userId, isScheduled])` - For scheduled longform posts
- `@@index([userId, isPublished])` - For published longform posts
- `@@index([userId, draft])` - For draft longform posts
- `@@index([isScheduled, scheduledFor])` - For cron job queries
- `@@index([userId, scheduledFor])` - For user-specific scheduled posts

### 2. Query Optimizations

#### Enhanced Include Statements

All post query functions now include related data in a single query:
- `queueType` - Queue type information
- `hashTagPreset` - Hashtag preset information
- `template` - Template information

**Functions Updated**:
- `getScheduledPosts()` - Now includes all relations
- `getDraftPosts()` - Now includes all relations
- `getPostedPosts()` - Now includes all relations
- `getRecentPostedPosts()` - Now includes all relations
- `getRecyclablePosts()` - Now includes all relations
- `getPostsByIds()` - Now includes all relations
- `getPostById()` - Now includes all relations

### 3. Query Batching Utilities

New utility functions for batch loading related data:

- `batchLoadUsers()` - Batch load users by IDs
- `batchLoadQueueTypes()` - Batch load queue types by IDs
- `batchLoadHashTagPresets()` - Batch load hashtag presets by IDs
- `batchLoadTemplates()` - Batch load templates by IDs
- `batchLoadPostRelations()` - Batch load all post relations

### 4. Query Performance Monitoring

Added Prisma middleware to monitor query performance:
- Logs slow queries (>100ms) in development
- Tracks query duration
- Logs model, action, and duration for debugging

## Migration Steps

### Step 1: Create and Apply Migration

```bash
# Generate migration for new indexes
pnpm exec prisma migrate dev --name add_query_performance_indexes

# Or in production
pnpm exec prisma migrate deploy
```

### Step 2: Verify Indexes

```sql
-- Check indexes on Post table
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'Post' 
ORDER BY indexname;

-- Check indexes on LongFormPost table
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'LongFormPost' 
ORDER BY indexname;
```

### Step 3: Test Query Performance

1. Enable query logging in development (already configured)
2. Monitor slow query warnings in console
3. Verify queries are using indexes with `EXPLAIN ANALYZE`

### Step 4: Monitor in Production

- Review slow query logs
- Monitor database query times
- Adjust indexes if needed based on actual usage patterns

## Performance Expectations

### Before Optimization
- Multiple queries for related data (N+1 problem)
- No indexes on commonly queried fields
- Queries could take 200-500ms+ for complex operations

### After Optimization
- Single query with all relations included
- Indexes on all common query patterns
- Target: <100ms for most queries
- P95: <200ms
- P99: <500ms

## Query Examples

### Before (N+1 Problem)
```typescript
// ❌ Bad: Multiple queries
const posts = await getScheduledPosts({ userId });
for (const post of posts) {
  const queueType = await getQueueTypeById(post.queueTypeId); // N queries!
}
```

### After (Optimized)
```typescript
// ✅ Good: Single query with includes
const posts = await getScheduledPosts({ userId });
// queueType, hashTagPreset, template already included
```

## Monitoring

### Development
- Slow queries (>100ms) are logged to console
- Query times are visible in Prisma logs

### Production
- Consider adding Prometheus metrics for query duration
- Set up alerts for slow queries
- Monitor database connection pool usage

## Rollback

If issues occur, you can rollback the migration:

```bash
# Rollback last migration
pnpm exec prisma migrate resolve --rolled-back <migration_name>

# Or manually drop indexes
DROP INDEX IF EXISTS "Post_userId_isScheduled_isPosted_idx";
DROP INDEX IF EXISTS "Post_userId_isPosted_idx";
-- ... etc
```

## Notes

- Indexes will slightly increase write time but significantly improve read performance
- Monitor index usage to ensure they're being utilized
- Consider adding more indexes based on actual query patterns in production
- The query batching utilities are available but may not be needed if `include` statements are sufficient

## References

- [Prisma Indexes Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [Query Optimization Guide](../reference/performance.md)
- [Database Schema](./database-schema.md)



