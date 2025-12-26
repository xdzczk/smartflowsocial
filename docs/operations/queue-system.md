# Queue System Documentation

This document describes the BullMQ-based queue system used for scheduling and processing posts in SmartFlowSocial.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Queue Types](#queue-types)
- [Worker Processes](#worker-processes)
- [Job Scheduling](#job-scheduling)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Scaling](#scaling)

---

## Overview

SmartFlowSocial uses **BullMQ** with **Redis** to handle:
- Scheduled post publishing
- Background job processing
- Recurring tasks (post checker)

### Why BullMQ?

- ✅ Reliable job processing
- ✅ Built-in retry mechanisms
- ✅ Job prioritization
- ✅ Delayed job scheduling
- ✅ Job status tracking
- ✅ Redis-backed persistence

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Server                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Queue Client (app/infra/queue/queue-client.ts)   │  │
│  │  - Enqueues jobs                                   │  │
│  │  - Cancels jobs                                    │  │
│  │  - Queries job status                              │  │
│  └──────────────────┬────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                      Redis Server                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Queues:                                           │  │
│  │  - scheduled-posts                                 │  │
│  │  - scheduled-longform-posts                        │  │
│  │  - post-checker                                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    Worker Process                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Workers (app/features/posts/queues.server.ts)    │  │
│  │  - scheduledPostsWorker                            │  │
│  │  - scheduledLongFormPostsWorker                   │  │
│  │  - postCheckerWorker                               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Queue Types

### 1. `scheduled-posts`

Processes scheduled short-form posts (notes).

**Job Data:**
```typescript
{
  postId: string;
  userId: string;
  signedEvent: any; // Nostr signed event
}
```

**Worker Behavior:**
- Updates post status to `isPosted: true`
- Publishes to Nostr via HTTP Publisher
- Concurrency: 5 jobs at a time
- Job retention: 100 completed, 50 failed

### 2. `scheduled-longform-posts`

Processes scheduled long-form articles (NIP-23).

**Job Data:**
```typescript
{
  postId: string;
  userId: string;
  signedEvent: any; // Nostr signed event
}
```

**Worker Behavior:**
- Updates post status to `isPublished: true`
- Publishes to Nostr via HTTP Publisher
- Concurrency: 5 jobs at a time
- Job retention: 100 completed, 50 failed

### 3. `post-checker`

Recurring job that checks for due posts and schedules them.

**Job Data:**
```typescript
{} // Empty, job runs on schedule
```

**Worker Behavior:**
- Runs every 60 seconds
- Checks for posts with `scheduledFor <= now`
- Enqueues jobs for due posts
- Concurrency: 1 (sequential processing)
- Job retention: 1 completed, 1 failed

---

## Worker Processes

### Starting Workers

Workers run in a separate process from the main application:

```bash
npm run start:worker
```

### Worker Configuration

Workers are configured in `app/features/posts/queues.server.ts`:

```typescript
export const scheduledPostsWorker = new Worker<PostJobData>(
  "scheduled-posts",
  async (job: Job<PostJobData>) => {
    // Process job
  },
  {
    connection: redis,
    concurrency: 5, // Process 5 jobs concurrently
  }
);
```

### Graceful Shutdown

Workers handle shutdown signals:

```typescript
process.on("SIGTERM", async () => {
  await scheduledPostsWorker.close();
  await scheduledLongFormPostsWorker.close();
  await postCheckerWorker.close();
  await closeAllQueues();
});
```

---

## Job Scheduling

### Enqueueing Jobs

Use the queue abstraction layer:

```typescript
import { enqueuePostJob } from "~/infra/queue";

// Schedule a post
await enqueuePostJob(
  postId,
  userId,
  signedEvent,
  scheduledFor // Unix timestamp in seconds
);
```

### Canceling Jobs

```typescript
import { cancelPostJob } from "~/infra/queue";

// Cancel a scheduled post
await cancelPostJob(postId);
```

### Job Options

Jobs support delayed execution:

```typescript
// Schedule for specific time (Unix timestamp in seconds)
await enqueuePostJob(postId, userId, signedEvent, 1704067200);

// Immediate processing (delay: 0)
await enqueuePostJob(postId, userId, signedEvent, 0);
```

---

## Configuration

### Redis Connection

Configure Redis URL in environment:

```env
REDIS_URL=redis://localhost:6379
```

For production with authentication:

```env
REDIS_URL=redis://:password@host:6379
```

### Queue Options

Default job options are configured in `app/infra/queue/queue-client.ts`:

```typescript
const queue = new Queue(queueName, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: queueName === "post-checker" ? 10 : 100,
    removeOnFail: queueName === "post-checker" ? 10 : 50,
  },
});
```

### Worker Concurrency

Adjust concurrency based on your needs:

```typescript
// High throughput
concurrency: 10

// Conservative
concurrency: 1

// Default
concurrency: 5
```

---

## Monitoring

### Redis CLI

Check queue status:

```bash
redis-cli -u $REDIS_URL

# List all keys
KEYS bull:*

# Check queue length
LLEN bull:scheduled-posts:waiting

# Get job details
HGETALL bull:scheduled-posts:1
```

### BullMQ Dashboard (Optional)

Install BullMQ dashboard for visual monitoring:

```bash
npm install @bull-board/express @bull-board/api
```

### Application Logs

Monitor worker logs:

```bash
# PM2
pm2 logs smartflow-worker

# Docker
docker logs smartflow-worker

# Direct
npm run start:worker
```

### Key Metrics to Monitor

1. **Queue Length**: Number of waiting jobs
2. **Failed Jobs**: Jobs that failed processing
3. **Processing Time**: Average job processing time
4. **Worker Status**: Are workers running?
5. **Redis Memory**: Redis memory usage

---

## Troubleshooting

### Jobs Not Processing

**Symptoms:**
- Jobs stuck in queue
- No worker activity

**Solutions:**

1. **Check Worker Status:**
   ```bash
   pm2 list
   # or
   ps aux | grep worker
   ```

2. **Check Redis Connection:**
   ```bash
   redis-cli -u $REDIS_URL ping
   # Should return: PONG
   ```

3. **Check Worker Logs:**
   ```bash
   pm2 logs smartflow-worker
   ```

4. **Verify Environment Variables:**
   ```bash
   echo $REDIS_URL
   echo $NOSTR_PUBLISHER_URL
   ```

### Jobs Failing

**Symptoms:**
- Jobs in "failed" state
- Error logs in worker

**Solutions:**

1. **Check Error Logs:**
   ```bash
   pm2 logs smartflow-worker --err
   ```

2. **Retry Failed Jobs:**
   ```typescript
   // In Redis CLI or application code
   const failedJobs = await queue.getFailed();
   for (const job of failedJobs) {
     await job.retry();
   }
   ```

3. **Check External Services:**
   - Verify Nostr Publisher is accessible
   - Check database connection
   - Verify user data exists

### High Memory Usage

**Symptoms:**
- Redis memory growing
- Slow job processing

**Solutions:**

1. **Reduce Job Retention:**
   ```typescript
   defaultJobOptions: {
     removeOnComplete: 50, // Reduce from 100
     removeOnFail: 25,     // Reduce from 50
   }
   ```

2. **Clean Old Jobs:**
   ```bash
   # In Redis CLI
   KEYS bull:*:completed
   DEL bull:*:completed
   ```

3. **Increase Redis Memory:**
   - Upgrade Redis instance
   - Configure Redis eviction policy

### Worker Crashes

**Symptoms:**
- Worker process dies
- Jobs not processing

**Solutions:**

1. **Use Process Manager:**
   ```bash
   pm2 start npm --name "worker" -- run start:worker
   pm2 save
   ```

2. **Check for Memory Leaks:**
   ```bash
   pm2 monit
   ```

3. **Add Error Handling:**
   ```typescript
   worker.on("failed", (job, err) => {
     console.error(`Job ${job.id} failed:`, err);
     // Log to error tracking service
   });
   ```

---

## Scaling

### Horizontal Scaling

Run multiple worker instances:

```bash
# PM2
pm2 start npm --name "worker-1" -- run start:worker
pm2 start npm --name "worker-2" -- run start:worker
pm2 start npm --name "worker-3" -- run start:worker

# Docker Compose
docker-compose scale worker=3
```

### Vertical Scaling

Increase worker concurrency:

```typescript
concurrency: 10 // Process more jobs simultaneously
```

### Redis Scaling

For high-volume deployments:

1. **Redis Cluster**: Distribute queues across multiple Redis nodes
2. **Redis Sentinel**: High availability setup
3. **Managed Redis**: Use AWS ElastiCache, Redis Cloud, etc.

### Load Balancing

When scaling workers:
- BullMQ automatically distributes jobs across workers
- No additional load balancing needed
- Jobs are processed by the first available worker

---

## Best Practices

### 1. Job Idempotency

Ensure jobs can be safely retried:

```typescript
// Check if already processed
const post = await getPost(postId);
if (post.isPosted) {
  return { alreadyPosted: true };
}
```

### 2. Error Handling

Always handle errors in job processors:

```typescript
try {
  // Process job
} catch (error) {
  console.error(`Job ${job.id} failed:`, error);
  // Log to error tracking
  throw error; // Re-throw to mark as failed
}
```

### 3. Job Timeouts

Set appropriate timeouts:

```typescript
await queue.add("job-name", data, {
  timeout: 30000, // 30 seconds
});
```

### 4. Monitoring

- Set up alerts for failed jobs
- Monitor queue length
- Track processing times
- Monitor Redis memory

### 5. Cleanup

Regularly clean up old jobs:

```typescript
// In a cron job
await queue.clean(24 * 60 * 60 * 1000, 100, "completed"); // 24 hours
```

---

## Additional Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)
- [Deployment Guide](./deployment.md)
- [Operations Guide](./operations.md)
- [Troubleshooting Guide](./troubleshooting.md)




