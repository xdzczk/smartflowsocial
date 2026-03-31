# Plan limits and upload policy (canonical)

This doc describes the canonical source of truth for **commercial plan limits** and **upload
validation**.

## Public plan ladder (commercial)

- **Free**
- **Creator**
- **Pro**
- **Teams** (placeholder; currently treated as paid per current code policy)
- **Founder**

## Legacy IDs → commercial plan mapping

Canonical mapping lives in:

- `app/features/payments/plan-mapping.ts`

Current legacy identifiers in the codebase:

- `free` → `free`
- `basic` → `creator`
- `premium` → `pro`
- `pro` → `pro` (legacy)
- `enterprise` → `pro` (legacy fallback)
- `teams` → `teams`
- `founder` → `founder`

## Canonical source of truth (limits)

Canonical plan policy lives in:

- `app/features/payments/plan-policy.ts`

Projections for existing subsystems derive from it:

- Execution entitlements: `getPlanEntitlements()` → `plan-policy` projection
  - `app/features/payments/entitlements/plan-entitlements.ts`
- Broadcast limits: `getBroadcastPlanLimits()` → `plan-policy` projection
  - `app/features/payments/types.ts`
- Giveaway limits: `getGiveawayPlanLimits()` → `plan-policy` projection
  - `app/features/payments/types.ts`

### Enforced server-side caps (Free)

- **Scheduled items**: 10 (`assertScheduleCapacity`)
- **Queues**: 1 (queue creation cap check)
- **Drafts**: 5 (draft capacity check)
- **Templates**: 5 (template capacity check)
- **Broadcast sending**: blocked (execution entitlement)
- **Bulk actions**: blocked (execution entitlement)

Enforcement entrypoints (server):

- `app/features/payments/entitlements/schedule-cap-policy.server.ts`
- `app/features/settings/actions/queue-types-actions.server.ts`
- `app/features/payments/entitlements/draft-template-cap.server.ts`
- `app/features/posts/bulkposts.action.server.ts`
- Broadcast send enforcement (tier caps + permission):
  - `app/features/broadcast/broadcast-campaign-actions.server.ts`
  - `app/features/broadcast/broadcast-actions-shared.server.ts`

## SFS Blossom storage eligibility

Policy intent:

- **Free**: must not receive SFS Blossom bulk upload tokens; must not use SFS-hosted quota.
- **Paid** (Creator/Pro/Teams/Founder): eligible.

Authoritative token issuance (SFS lane):

- `app/features/upload/services/blossom-v2.server.ts` (`issueBlossomBulkTokens`)
- Route:
  - `app/routes/api.blossom.tokens.tsx`

Free requests are rejected with a structured authorization error message:

- “SmartFlowSocial-hosted media storage is available on paid plans.”

## Canonical upload policy (matrix)

Canonical upload policy lives in:

- `app/features/upload/upload-policy.ts`

Upload contexts currently defined:

- `general_media_upload`
- `editorjs_image_upload`
- `blossom_direct_upload`
- `bulk_media_upload`
- `blossom_tokenized_bulk_upload`

### EditorJS rule normalization

Canonical decision: **EditorJS image upload max = 10MB** end-to-end:

- Multipart parsing size cap
- Runtime validation
- Error messages (central policy)

EditorJS endpoint:

- `app/routes/api.upload-editorjs-image.tsx`

General upload validation:

- `app/features/upload/validation.server.ts` uses canonical MIME allowlist.

## Message source of truth (cap hits / restrictions)

Centralized message helpers:

- `app/features/payments/entitlements/entitlement-messages.ts`

Avoid inventing per-route variations; use these helpers when returning cap-hit / plan-restriction
UX.

## Seeded Plan rows (legacy/non-authoritative)

`Plan.maxPostsPerMonth`, `maxQueueTypes`, `maxTemplates`, `maxLongFormPosts` exist in Prisma and are
seeded (see `prisma/seed.ts`), but **they are not the enforcement source** for current execution
caps.\n+ Canonical enforcement should come from `plan-policy.ts` and its projections.\n+
