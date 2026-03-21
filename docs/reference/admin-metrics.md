# Admin metrics (operator reference)

Definitions used by `/dashboard/admin` loaders: date helpers in `app/features/admin/metrics/`, DB
aggregates in `app/features/admin/repositories/*-queries.server.ts`.

## Time range

URL query `range`: `24h` | `7d` | `30d` | `90d` | `all`. Each tab picks a default when the param is
missing (see `defaultRangeForAdminPath`).

## Overview

- **Active paid users**: `Subscription.status === ACTIVE` (current count; no historical delta
  without a time series table).
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
- **Relay (range)**: ratio of `PublishRelayAck` rows with `ACCEPTED` vs `FAILED`/`TIMEOUT` in the
  selected window.

Prometheus counters on the worker are **not** used for admin cards (separate processes).

## Payout audit

`ReferralPayoutAuditLog` records manual and batch-related events (per-referrer outcomes in batch,
plus a summary row with `batchSummary`). Use it as the operator ledger; `ReferralEarning` rows
remain the accounting source of truth.
