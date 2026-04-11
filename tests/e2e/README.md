# E2E Testing (Cypress)

Rewritten E2E suite focused on stable, business-critical user journeys.

## Suite Layout

- `tests/e2e/smoke`: merge-gate critical checks.
- `tests/e2e/core`: primary product workflows.
- `tests/e2e/extended`: lower-frequency feature coverage.
- `tests/e2e/support`: shared auth/setup commands and helpers.

## Conventions

- Foundation rules live in `tests/e2e/FOUNDATION.md`.
- Legacy mapping and retirement decisions live in `tests/e2e/LEGACY_MIGRATION_MAP.md`.
- Prefer `cy.getByTestId(...)` and semantic selectors over class or DOM-structure selectors.
- Avoid fixed waits and rely on route/UI state assertions.

## Commands

```bash
# Run all rewritten E2E tests
pnpm test:e2e

# Run only smoke gate
pnpm test:e2e:smoke

# Run only core workflows
pnpm test:e2e:core

# Run extended coverage
pnpm test:e2e:extended

# Start app + run smoke suite (CI-like local run)
pnpm test:e2e:smoke:run

# Start app + run all E2E tests
pnpm test:e2e:run
```

## CI Workflow

- Workflow: `.github/workflows/e2e.yml`
- Job `e2e-smoke` is burn-in aware:
  - Non-blocking while `E2E_ENFORCE_SMOKE != "true"`.
  - Blocking when `E2E_ENFORCE_SMOKE == "true"`.
- Job `e2e-core` is opt-in via workflow dispatch or `E2E_RUN_CORE == "true"`.

## Promotion Checklist (Smoke Required Gate)

1. Smoke pass rate >= 98% over 2 weeks.
2. Flake rate < 2% per smoke spec.
3. Set repo variable `E2E_ENFORCE_SMOKE=true`.
4. Mark `E2E Smoke (Burn-in Aware)` as required in branch protection.
