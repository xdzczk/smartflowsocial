# E2E Coverage Summary

## Active Suite

### Smoke (P0)

- `smoke/critical-path.cy.ts`
- `smoke/auth-session.cy.ts`
- `smoke/dashboard-shell.cy.ts`
- `smoke/compose-publish.cy.ts`

### Core (P1)

- `core/scheduling.cy.ts`
- `core/drafts.cy.ts`
- `core/templates.cy.ts`
- `core/settings.cy.ts`

### Extended (P2)

- `extended/subscription.cy.ts`
- `extended/search.cy.ts`
- `extended/broadcasts.cy.ts`

## Coverage Intent

- **Smoke**: merge confidence for auth, dashboard, and compose flow.
- **Core**: regression checks for primary daily workflows.
- **Extended**: business expansion areas outside strict merge gate.

## Decommissioning Status

- Legacy root-level MVP specs were retired and replaced by foldered suite.
- Mapping reference: `tests/e2e/LEGACY_MIGRATION_MAP.md`.
