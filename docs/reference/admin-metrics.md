# Admin metrics (operator reference)

Definitions used by `/dashboard/admin` loaders: date helpers in `app/features/admin/metrics/`, DB
aggregates in `app/features/admin/repositories/*-queries.server.ts`.

## Metric registry (source of truth)

Canonical labels, descriptions, formulas, domains, and range semantics for operator-facing metrics
live in [`app/features/admin/metrics/registry.ts`](../../app/features/admin/metrics/registry.ts)
(`METRIC_DEFINITIONS`). Shared confidence helpers:
[`resolve-confidence.ts`](../../app/features/admin/metrics/resolve-confidence.ts). Bundles compose
SQL for tabs: `app/features/admin/repositories/admin-*-bundle.server.ts`.

## Product sessions & signer reconnect

- **ProductSession**: dashboard session beacons from `/api/product-session` (start / heartbeat /
  end) for DAU-style rollups. Distinct from auth `Session` rows in Prisma.
- **SignerReconnectEvent**: failed (and optionally future success) outcomes from NIP-46
  `tryBackgroundReconnect` posted to `/api/signer-reconnect`. Used for reconnect health, not
  per-sign latency analytics.

## Time range

URL query `range`: `24h` | `7d` | `30d` | `90d` | `all`. Each tab picks a default when the param is
missing (see `defaultRangeForAdminPath`).

## Overview

- **Active paid users**: `Subscription.status === ACTIVE` and `planId` is not the built-in free plan
  (`free`). Current count only (no historical delta without a time series table).
- **Referrals snapshot - Active seats (all plans)**: all `Subscription.status === ACTIVE` rows,
  including free tier.
- **New users**: `User.createdAt` in `[from, to)`.
- **Posts published**: short posts with `currentState === PUBLISHED` and `publishedAt` in range;
  long-form analogous.
- **Publish success rate**: `100 * published / (published + failed)` where “failed” counts short
  posts moved to `FAILED` with `updatedAt` in the same range (approximation).
- **Active publishers (proxy)**: distinct users with at least one published short or long-form post
  in the range (via `publishedAt`).
- **Pending payout (sats)**: sum of `ReferralEarning.commissionSats` where `status === PENDING`.

## System health

- **Database**: `SELECT 1`.
- **Queues**: BullMQ `getJobCounts` from the Remix server process (requires Redis reachable like
  workers).
- **Outbox**: `getOutboxBacklogCounts`.
- **Workers (heuristic)**: no heartbeat - derived from summed `waiting` / `active` across the same
  queues. Healthy when jobs are active or backlog is small; degraded at ≥25 waiting with 0 active;
  failing at ≥100 waiting with 0 active.

Relay ACK ratios stay on **Operations** and Overview copy only; they are **not** infra health cards.
An Overview **alert** fires only when the accepted share of ACK rows in the range is under 25% and
there are at least 20 samples.

Prometheus counters on the worker are **not** used for admin cards (separate processes).

## Operations maintenance

Admin **Operations → Operational cleanup** (referral admins only, CSRF-protected):

- **Clean failed queue jobs**: BullMQ `Queue.clean` on failed jobs for `scheduled-posts`,
  `scheduled-longform-posts`, `post-checker`, and `broadcast-dm` (batched, up to 10k removals per
  queue per run). Does not change `Post` / `LongFormPost` state or `DeadLetterJob` rows.
- **Purge old relay ACKs**: `PublishRelayAck.deleteMany` where `createdAt` is before a cutoff;
  retention days are clamped to **7–365** (default from the form is 30). Logged with operator
  context.

## Payout audit

`ReferralPayoutAuditLog` records manual and batch-related events (per-referrer outcomes in batch,
plus a summary row with `batchSummary`). Use it as the operator ledger; `ReferralEarning` rows
remain the accounting source of truth.
