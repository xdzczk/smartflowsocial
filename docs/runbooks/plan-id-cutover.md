# Plan ID Cutover Runbook

This runbook executes the strict plan ID cutover from legacy IDs to canonical IDs:

- `basic` -> `creator`
- `premium` -> `pro`

## Preconditions

- Maintenance window announced.
- Checkout and renewal writes paused.
- App deploy with strict canonical validation is ready.
- Run precheck SQL:
  - `scripts/VERIFY_PLAN_ID_CUTOVER.sql`

## Deployment Sequence

1. Put app in maintenance mode (or disable plan-changing writes).
2. Apply Prisma migration:
   - `prisma/migrations/20260410230000_plan_id_cutover_creator_pro/migration.sql`
3. Deploy app version with canonical-only runtime logic.
4. Run post-cutover verification SQL:
   - `scripts/VERIFY_PLAN_ID_CUTOVER.sql`
5. Resume checkout/renewal traffic.

## Post-Deploy Smoke Tests

- Checkout flow succeeds for `starter`, `creator`, `pro`, `founder`.
- Checkout flow rejects legacy IDs (`basic`, `premium`).
- Existing paid users still resolve correct entitlements.
- Scheduled downgrade metadata resolves canonical IDs only.

## Rollback Notes

- This migration is intentionally strict and forward-only.
- If rollback is required, restore from DB backup/snapshot taken pre-migration.
