# E2E Foundation Conventions

This document defines non-negotiable conventions for the rewritten E2E suite.

## Auth and Session

- Use `cy.loginNostr()` in `beforeEach` for authenticated specs.
- Use `cy.cleanupNostrUser()` in `afterEach` to keep tests isolated.
- Use `TEST_NPUB` as the deterministic account identity unless a test needs a custom user.

## Selector Policy

- Preferred order:
  1. `cy.getByTestId(...)`
  2. role/text assertions (`cy.contains(...)`)
  3. semantic attribute selectors (`[aria-label=...]`, `button[type=submit]`)
- Disallowed by default:
  - class-based selectors (`.foo`, `[class*=foo]`)
  - DOM-structure selectors (`main > div > :nth-child(2)`)
- Any temporary selector exception must be documented in the test with a short comment.

## Navigation and Waits

- Use `cy.visitAndCheck("/path")` for route entry.
- Use `cy.assertPathname("fragment")` for route assertions.
- Do not use fixed waits (`cy.wait(1000)`) for UI readiness.
- Wait on stable UI signals (test IDs, route state, content text) instead.

## Data Determinism

- Every spec must prepare and verify its own prerequisites.
- Avoid dependence on state created by earlier tests.
- External integrations (payments, link previews, publisher relays) should be mocked/stubbed per
  test when possible.

## Suite Structure

- `tests/e2e/smoke`: required merge-gate critical checks.
- `tests/e2e/core`: essential product workflows.
- `tests/e2e/extended`: lower-frequency and growth scenarios.
