# Legacy E2E Inventory and Migration Map

This file tracks how each legacy MVP-era Cypress spec maps to the rewritten suite.

## Classification Legend

- **rewrite**: replace with a new flow-oriented spec.
- **drop**: remove from E2E scope (covered better by unit/integration/performance checks).

## Legacy Spec Mapping

| Legacy file                       | Classification | Replacement target                                  |
| --------------------------------- | -------------- | --------------------------------------------------- |
| `tests/e2e/smoke.cy.ts`           | rewrite        | `tests/e2e/smoke/critical-path.cy.ts`               |
| `tests/e2e/authentication.cy.ts`  | rewrite        | `tests/e2e/smoke/auth-session.cy.ts`                |
| `tests/e2e/navigation.cy.ts`      | rewrite        | `tests/e2e/smoke/dashboard-shell.cy.ts`             |
| `tests/e2e/post-creation.cy.ts`   | rewrite        | `tests/e2e/smoke/compose-publish.cy.ts`             |
| `tests/e2e/post-scheduling.cy.ts` | rewrite        | `tests/e2e/core/scheduling.cy.ts`                   |
| `tests/e2e/drafts.cy.ts`          | rewrite        | `tests/e2e/core/drafts.cy.ts`                       |
| `tests/e2e/templates.cy.ts`       | rewrite        | `tests/e2e/core/templates.cy.ts`                    |
| `tests/e2e/settings.cy.ts`        | rewrite        | `tests/e2e/core/settings.cy.ts`                     |
| `tests/e2e/calendar.cy.ts`        | rewrite        | `tests/e2e/core/scheduling.cy.ts`                   |
| `tests/e2e/dashboard-flow.cy.ts`  | rewrite        | `tests/e2e/smoke/dashboard-shell.cy.ts`             |
| `tests/e2e/subscription.cy.ts`    | rewrite        | `tests/e2e/extended/subscription.cy.ts`             |
| `tests/e2e/published-posts.cy.ts` | drop           | Covered by integration tests + publish smoke checks |
| `tests/e2e/bulk-posts.cy.ts`      | drop           | Move to focused integration tests for upload parser |
| `tests/e2e/engagement.cy.ts`      | drop           | Lower business criticality for merge gate           |
| `tests/e2e/recyclables.cy.ts`     | drop           | Lower business criticality for merge gate           |
| `tests/e2e/long-form-posts.cy.ts` | drop           | Covered by editor/integration tests                 |
| `tests/e2e/interactions.cy.ts`    | drop           | Convert to component/integration interaction tests  |
| `tests/e2e/api-endpoints.cy.ts`   | drop           | API coverage belongs to integration/API tests       |
| `tests/e2e/performance.cy.ts`     | drop           | Covered by `tests/performance` suite                |
| `tests/e2e/mobile-viewport.cy.ts` | drop           | Better as visual/regression checks                  |
| `tests/e2e/accessibility.cy.ts`   | drop           | Move to focused accessibility tooling and CI checks |

## Rewrite Scope

### P0 smoke (merge gate after burn-in)

- `smoke/critical-path.cy.ts`
- `smoke/auth-session.cy.ts`
- `smoke/dashboard-shell.cy.ts`
- `smoke/compose-publish.cy.ts`

### P1 core

- `core/scheduling.cy.ts`
- `core/drafts.cy.ts`
- `core/templates.cy.ts`
- `core/settings.cy.ts`

### P2 extended

- `extended/subscription.cy.ts`
- `extended/search.cy.ts`
- `extended/broadcasts.cy.ts`
