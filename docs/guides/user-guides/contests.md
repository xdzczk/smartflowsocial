# Contests Guide

**Estimated time:** 20 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-04-11

Learn how to run ranked contests from a source post, review winners, lock results, and complete
payout tracking in SmartFlowSocial.

---

## Table of Contents

- [Overview](#overview)
- [Before You Start](#before-you-start)
- [Contest Lifecycle](#contest-lifecycle)
- [Create a Contest](#create-a-contest)
- [Review, Freeze, and Lock](#review-freeze-and-lock)
- [Payout Tracking](#payout-tracking)
- [Presets and Proof Studio](#presets-and-proof-studio)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Contests help you run engagement competitions with deterministic ranking and auditable results:

- Define contest rules from a source note
- Rank entries by configured metrics
- Freeze results for review and lock winners
- Track payout status through completion
- Export contest entries and use proof/receipt workflows

Contests are available under **Dashboard → Contests** when enabled for your environment/plan.

---

## Before You Start

1. Make sure contests are enabled on your deployment.
2. Open **Dashboard → Contests → New contest**.
3. Choose the source post and scoring setup.

If the section is unavailable, ask your operator to verify contest feature settings and plan access.

---

## Contest Lifecycle

Contests move through these states:

`DRAFT → LIVE → ENDED_REVIEW → LOCKED → PAYOUT_IN_PROGRESS → COMPLETED`

Cancelable path:

`DRAFT/LIVE → CANCELLED` (before lock)

High-level behavior:

- **LIVE**: contest accepts/collects entries according to your rules.
- **ENDED_REVIEW**: contest data is frozen for final checks.
- **LOCKED**: winner set is fixed for payout execution.
- **PAYOUT_IN_PROGRESS**: payout operations are tracked.
- **COMPLETED**: campaign is finalized with proof/receipt outputs.

---

## Create a Contest

In **New contest**, configure:

- Contest name and schedule/deadline
- Source post
- Entry type and ranking metric
- Prize/winner structure
- Fairness settings

Then launch when ready.

Tip: start with a short test contest to validate your scoring and tie-break expectations.

---

## Review, Freeze, and Lock

From contest detail:

1. Review entries and leaderboard
2. Freeze snapshot at deadline
3. Validate winner set and alternates
4. Lock the contest to finalize winners

After lock, winner selection is treated as final for payout tracking.

---

## Payout Tracking

Contest detail supports payout operations and status management:

- Wallet payout runs (when configured)
- Manual payout status updates
- Batch payout workflows
- Completion once payouts are finalized

Common payout language:

- **Pay winners now**
- **Payout method**
- **Auto-pay after lock**
- **Mark paid manually**
- **Finish campaign**

---

## Presets and Proof Studio

### Presets

Use **Contests → Presets** to save reusable contest configurations and speed up repeat campaigns.

### Proof Studio

Use **Contests → Proof Studio** to generate/share contest proof artifacts and completion evidence.

---

## Best Practices

1. Publish contest rules clearly before launch.
2. Keep ranking metrics simple for participants.
3. Freeze and review before lock; avoid rushed lock actions.
4. Keep payout notes/statuses up to date for auditability.
5. Export entries before completion for external records.

---

## Troubleshooting

### Contest section is missing

- Verify contest feature enablement in your deployment
- Verify your plan/entitlements include contest access

### Cannot lock contest

- Ensure review/freeze step completed
- Resolve validation or state transition errors shown in detail view

### Payout run failed

- Retry payout batch
- Fall back to manual payout tracking where needed
- Complete campaign only after statuses are correct

---

## Related Documentation

- [Giveaways Guide](./giveaways.md)
- [Payments Guide](./payments.md)
- [Plan Features](../../reference/plan-features.md)
- [Contests v1 Architecture](../../contests-v1-architecture.md)

---

**Next:** [Giveaways Guide](./giveaways.md) → Compare giveaway and contest workflows
