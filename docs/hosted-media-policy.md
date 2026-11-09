## SmartFlowSocial-hosted media policy (SFS Blossom)

### Commercial tiers

- **Free**: no SmartFlowSocial-hosted media
- **Creator**: first hosted-media tier
- **Pro**: operator-grade hosted-media tier
- **Founder**: inherits Pro hosted-media limits (for now)
- **Teams**: coming soon; do not publicly advertise hosted-media limits yet

### Hosted-media limits (canonical)

#### Free

- **canUseSfsBlossomStorage**: false
- **tokens**: none
- **monthly hosted storage quota**: none
- **monthly hosted upload quota**: none

#### Creator

- **monthly hosted storage**: 10 GB
- **monthly hosted uploads**: 40 GB
- **max hosted file size**: 100 MB
- **max parallel uploads hint**: 6

#### Pro

- **monthly hosted storage**: 50 GB
- **monthly hosted uploads**: 250 GB
- **max hosted file size**: 250 MB
- **max parallel uploads hint**: 8

#### Founder

- **same as Pro**

### Enforcement (must exist in both layers)

- **App policy and UX** (this repo):
  - Canonical policy: `app/features/payments/plan-policy.ts`
  - Token issuance and quota checks: `app/features/upload/services/blossom-v2.server.ts`
  - Plans page: `app/features/payments/components/PlansPage.tsx` and `FeatureComparisonTable.tsx`
- **Blossom gateway**
  ([smartflowsocial-blossom](https://github.com/xdzczk/smartflowsocial-blossom)):
  - Policy mirror: `src/planPolicy.ts`
  - Upload boundary: `src/routes/upload.ts`

### Drift prevention

The numbers above are mirrored in `app/features/payments/plan-policy.ts` and in `src/planPolicy.ts`
in the Blossom repository. Change both in the same pass.
