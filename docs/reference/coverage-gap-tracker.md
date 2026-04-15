# Coverage Gap Tracker

Baseline source: `coverage/coverage-summary.json`

Global baseline:

- Lines: `72.36`
- Branches: `62.50`
- Functions: `75.52`
- Statements: `71.38`

Global target:

- Lines: `>= 75`
- Branches: `>= 67`
- Functions: `>= 75`
- Statements: `>= 75`

## Workstream W1: Zero/Near-Zero Critical Libraries

| File                                                          | Baseline (L/B/F/S) | Target        | Test File(s)                           | Status |
| ------------------------------------------------------------- | ------------------ | ------------- | -------------------------------------- | ------ |
| `app/lib/proof/build-proof-caption.ts`                        | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-proof.test.ts` | done   |
| `app/lib/proof/build-proof-summary.ts`                        | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-proof.test.ts` | done   |
| `app/lib/proof/export-proof-card.ts`                          | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-proof.test.ts` | done   |
| `app/lib/proof/themes.ts`                                     | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-proof.test.ts` | done   |
| `app/lib/proof/adapters/contest.ts`                           | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-proof.test.ts` | done   |
| `app/lib/proof/adapters/giveaway.ts`                          | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-proof.test.ts` | done   |
| `app/lib/site-url.ts`                                         | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-utils.test.ts` | done   |
| `app/lib/html-to-plain-text.ts`                               | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-utils.test.ts` | done   |
| `app/features/engagement/services/engagement-deep-links.ts`   | `0/100/0/0`        | `>=70L >=55B` | `tests/unit/coverage-w1-utils.test.ts` | done   |
| `app/features/engagement/utils/engagement-content-preview.ts` | `0/0/0/0`          | `>=70L >=55B` | `tests/unit/coverage-w1-utils.test.ts` | done   |

## Workstream W2: Auth Reconnect/Signer

| File                                                              | Baseline (L/B/F/S)        | Target               | Test File(s)                                                  | Status |
| ----------------------------------------------------------------- | ------------------------- | -------------------- | ------------------------------------------------------------- | ------ |
| `app/features/auth/reconnect/reconnect-connect-actions.client.ts` | `0/0/0/0`                 | `+15B from baseline` | `tests/unit/auth/reconnect/reconnect-connect-actions.test.ts` | done   |
| `app/features/auth/reconnect/useExistingReconnectFlow.client.ts`  | `29.85/30.55/14.28/29.57` | `+15B from baseline` | `tests/unit/auth/reconnect/useExistingReconnectFlow.test.tsx` | done   |
| `app/features/auth/signer/connection-resolve.client.ts`           | `48/40.96/71.42/46.79`    | `+15B from baseline` | `tests/unit/auth/signer/connection-resolve.test.ts`           | done   |
| `app/features/auth/signer/nostr-signer-connection.client.ts`      | `70.06/63.33/59.09/69.37` | `+15B from baseline` | `tests/unit/auth/signer/nostr-signer-connection.test.ts`      | done   |

## Workstream W3: Posts Utilities

| File                                                                          | Baseline (L/B/F/S)        | Target  | Test File(s)                                                      | Status |
| ----------------------------------------------------------------------------- | ------------------------- | ------- | ----------------------------------------------------------------- | ------ |
| `app/features/posts/utils/bulk-post-events-fetcher.utils.ts`                  | `0/0/0/0`                 | `>=70L` | `tests/unit/posts/utils/bulk-post-events-fetcher.utils.test.ts`   | done   |
| `app/features/posts/utils/bulk-prepared-event-display.utils.ts`               | `0/0/0/0`                 | `>=70L` | `tests/unit/posts/utils/posts-utils-coverage.test.ts`             | done   |
| `app/features/posts/drafts/utils/draft-search-haystack.ts`                    | `0/0/0/0`                 | `>=70L` | `tests/unit/posts/utils/posts-utils-coverage.test.ts`             | done   |
| `app/features/posts/drafts/utils/drafts-toolbar-segments.ts`                  | `0/100/0/0`               | `>=70L` | `tests/unit/posts/utils/posts-utils-coverage.test.ts`             | done   |
| `app/features/posts/calendar/Calendar/utils/reschedule-repost-quote.utils.ts` | `11.76/36.36/33.33/16.66` | `>=70L` | `tests/unit/posts/calendar/reschedule-repost-quote.utils.test.ts` | done   |

## Workstream W4: Core Lib Branch Gaps

| File                                     | Baseline (L/B/F/S) | Target  | Test File(s)                                         | Status |
| ---------------------------------------- | ------------------ | ------- | ---------------------------------------------------- | ------ |
| `app/lib/seo.ts`                         | `14.28/0/0/13.95`  | `>=50B` | `tests/unit/lib/seo.test.ts`                         | done   |
| `app/lib/seo-dashboard-routes.ts`        | `0/0/0/0`          | `>=50B` | `tests/unit/lib/seo.test.ts`                         | done   |
| `app/lib/nostr-signer-encrypt.client.ts` | `0/0/0/0`          | `>=50B` | `tests/unit/lib/nostr-signer-encrypt.client.test.ts` | done   |
| `app/lib/product-feedback-dm.client.ts`  | `2.85/0/0/2.7`     | `>=50B` | `tests/unit/lib/product-feedback-dm.client.test.ts`  | done   |
| `app/lib/theme.client.ts`                | `6.15/0/0/4.59`    | `>=50B` | `tests/unit/lib/theme.client.test.ts`                | done   |
| `app/lib/telemetry/product-session.tsx`  | `7.69/0/0/6.66`    | `>=50B` | `tests/unit/lib/product-session.test.tsx`            | done   |

## Workstream W5: Validation Branch Completion

| File                                                   | Baseline (L/B/F/S)        | Target  | Test File(s)                                                   | Status |
| ------------------------------------------------------ | ------------------------- | ------- | -------------------------------------------------------------- | ------ |
| `app/lib/validation/schemas/posts.schemas.ts`          | `77.63/40/100/77.92`      | `>=70B` | `tests/unit/validation/posts-settings-branches.test.ts`        | done   |
| `app/lib/validation/schemas/settings.schemas.ts`       | `73.71/58.5/67.24/74.05`  | `>=70B` | `tests/unit/validation/posts-settings-branches.test.ts`        | done   |
| `app/lib/validation/normalize-loader-response-data.ts` | `74.22/70.33/76.19/72.81` | `>=70B` | `tests/unit/validation/normalize-loader-response-data.test.ts` | done   |

## Final Results

- Global current:
  - Lines: `86.20`
  - Branches: `74.45`
  - Functions: `88.91`
  - Statements: `84.90`
- Full coverage run produced updated metrics and wrote reports; global targets are exceeded.
- `pnpm lint` passed.
- `pnpm test` and `pnpm test:coverage` currently fail in this local environment due existing DB
  connectivity test failures (`ECONNREFUSED` to postgres at `5433`) in integration suites unrelated
  to the added coverage tests.
