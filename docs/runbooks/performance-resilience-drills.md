# Performance Resilience Drills

This runbook defines repeatable resilience drills and a release-readiness policy for
SmartFlowSocial.

## Objectives

- Validate behavior under dependency degradation (DB, Redis, queue worker).
- Verify SLO alerting and on-call response timing.
- Convert findings into durable engineering actions before releases.

## Drill Cadence

- Weekly: one focused drill (single failure mode).
- Monthly: combined drill (multi-failure sequence).
- Before major releases: mandatory queue + database drill replay.

## Drill Scenarios

### 1) Database Degradation Drill

Simulate high query latency and connection pressure.

Steps:

1. Increase artificial DB load in staging.
2. Run read/write traffic with `tests/performance/loader-performance.js`.
3. Observe:
   - `prisma_query_duration_ms` p95/p99
   - `prisma_slow_query_total`
   - API p95 and error rate
4. Confirm alerts fire and route to owner.

Pass criteria:

- API availability stays above 99.9% budget window.
- No sustained queue backlog > 5m.
- Recovery to baseline p95 in < 15 minutes after load removal.

### 2) Redis / Queue Backpressure Drill

Simulate delayed queue consumption and Redis contention.

Steps:

1. Reduce worker concurrency or add synthetic Redis latency in staging.
2. Trigger scheduled publish traffic.
3. Observe:
   - `queue_oldest_waiting_age_seconds`
   - `publish_lateness_seconds`
   - `outbox_oldest_ready_age_seconds`
4. Restore normal worker settings.

Pass criteria:

- Alerts trigger within target windows.
- No dead-letter surge above defined threshold.
- Backlog drains to normal in < 20 minutes.

### 3) Worker Restart / Failover Drill

Simulate abrupt worker interruption.

Steps:

1. Stop worker process during active scheduled jobs.
2. Keep web app running and continue user traffic.
3. Restart worker and monitor catch-up.
4. Validate no duplicate publish side effects.

Pass criteria:

- No data corruption or duplicate terminal state transitions.
- Queue recovery with stable error rate.
- End-to-end publish lateness returns to SLO.

## After-Action Template

For each drill, capture:

- Date/time and environment
- Trigger and scope
- Alert timeline
- Mitigation timeline
- SLO impact
- Root cause notes
- Follow-up tasks with owner + due date

## Release Readiness Policy

Release is blocked if any of the following are true:

- Critical SLO alert firing at decision time.
- Unresolved high-severity finding from last resilience drill.
- Performance budget check failing in CI.
- Queue backlog/latency SLO unresolved for > 4 hours.

Release is allowed when:

- All CI performance and budget checks pass.
- Latest required drills are completed and documented.
- Open performance findings are accepted with explicit mitigation plan and owner.
