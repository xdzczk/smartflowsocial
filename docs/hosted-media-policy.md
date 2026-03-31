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

- **App policy + UX** (this repo):\n+ - Canonical policy:
  `app/features/payments/plan-policy.ts`\n+ - Token issuance/quota checks:
  `app/features/upload/services/blossom-v2.server.ts`\n+ - Plans page marketing + comparison:
  `app/features/payments/components/PlansPage.tsx`,
  `app/features/payments/components/FeatureComparisonTable.tsx`\n+- **Blossom gateway enforcement**
  (`/Users/ivmitko/Documents/Dev/vibe-cdn-master`):\n+ - Central policy mirror:
  `src/planPolicy.ts`\n+ - Upload boundary enforcement: `src/routes/upload.ts`\n+

### Drift prevention

The hosted-media numbers above are intentionally mirrored between:\n+-
`vibe-smartflow-main/app/features/payments/plan-policy.ts`\n+-
`vibe-cdn-master/src/planPolicy.ts`\n+\n+If you change hosted-media limits, update **both files in
the same pass**.
