# Feature Coverage Matrix

**Last audited:** 2026-04-11  
**Scope:** Product features and API surfaces mapped to canonical documentation pages.

---

## Product Feature Coverage

| Feature Area                   | Canonical Documentation                                                      | Status     | Notes                                            |
| ------------------------------ | ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------ |
| Authentication (NIP-07/NIP-46) | `docs/reference/nostr.md`, `docs/getting-started/concepts.md`                | ✅ Covered | Includes challenge/verify model and signer flows |
| Posting (short notes)          | `docs/guides/user-guides/posting.md`                                         | ✅ Covered | Compose, schedule, publish                       |
| Long-form posts (NIP-23)       | `docs/guides/user-guides/posting.md`, `docs/reference/nostr.md`              | ✅ Covered | Kind `30023` support                             |
| Calendar scheduling            | `docs/guides/user-guides/calendar.md`                                        | ✅ Covered | Drag-and-drop scheduling                         |
| Queues and scheduling rules    | `docs/guides/user-guides/posting.md`, `docs/getting-started/concepts.md`     | ✅ Covered | Queue-based timing behavior                      |
| Drafts/templates/recyclables   | `docs/guides/user-guides/posting.md`, `docs/guides/user-guides/templates.md` | ✅ Covered | Reusable content workflows                       |
| Search and event lookup        | `docs/guides/user-guides/search.md`, `docs/guides/user-guides/engagement.md` | ✅ Covered | Includes event search workflows                  |
| Engagement feed and triage     | `docs/guides/user-guides/engagement.md`                                      | ✅ Covered | Reply workflows and state handling               |
| Giveaways                      | `docs/guides/user-guides/giveaways.md`                                       | ✅ Covered | Winner selection and payout terminology          |
| Broadcast campaigns            | `docs/guides/user-guides/broadcasts.md`                                      | ✅ Covered | Audience resolution, review, suppression         |
| Contests v1                    | `docs/guides/user-guides/contests.md`, `docs/contests-v1-architecture.md`    | ✅ Covered | Lifecycle, lock, payouts, proof                  |
| Multi-account                  | `docs/guides/user-guides/multi-account.md`                                   | ✅ Covered | Parent/child management                          |
| Media and assets               | `docs/guides/user-guides/assets.md`, `docs/reference/api.md`                 | ✅ Covered | Upload pipelines and media commit                |
| Payments and subscriptions     | `docs/guides/user-guides/payments.md`, `docs/reference/configuration.md`     | ✅ Covered | NWC and BTCPay environment setup                 |
| Push notifications             | `docs/reference/api.md`, `docs/reference/configuration.md`                   | ✅ Covered | Subscribe/unsubscribe and VAPID config           |
| Admin operations               | `docs/guides/operations.md`, `docs/reference/admin-metrics.md`               | ✅ Covered | Operational/admin tooling references             |

---

## API Surface Coverage

| API Group                                                                                                           | Canonical Documentation | Status     | Notes                                          |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- | ---------------------------------------------- |
| Upload APIs (`/api/upload*`, `/api/media/*`, `/api/blossom/*`)                                                      | `docs/reference/api.md` | ✅ Covered | Includes intents/commit and blossom token flow |
| Post APIs (`/api/publish`, `/api/posts/*`, `/api/post-stats`, `/api/publish-result`)                                | `docs/reference/api.md` | ✅ Covered | Includes `thread-group` support                |
| Queue APIs (`/api/queue-schedule`, `/api/effective-hashtags`)                                                       | `docs/reference/api.md` | ✅ Covered | Scheduling helpers                             |
| Search APIs (`/api/global-search`, `/api/search/thread-replies`)                                                    | `docs/reference/api.md` | ✅ Covered | Event and nested thread search                 |
| Engagement APIs (`/api/engagement/*`)                                                                               | `docs/reference/api.md` | ✅ Covered | State, templates, and actions                  |
| Broadcast APIs (`/api/broadcast-*`)                                                                                 | `docs/reference/api.md` | ✅ Covered | Audience resolution and finalize               |
| User/account APIs (`/api/children`, `/api/parent`, `/api/primary-signer-profile`)                                   | `docs/reference/api.md` | ✅ Covered | Account linkage and signer profile             |
| External/helper APIs (`/api/thread-view`, `/api/zap-profile`, `/api/profile-display-name`, `/api/link-preview`)     | `docs/reference/api.md` | ✅ Covered | Read-side helpers                              |
| Feedback API (`/api/feedback-dm`)                                                                                   | `docs/reference/api.md` | ✅ Covered | Signed feedback DM flow                        |
| Payment APIs (`/api/payment-status`, `/api/zap-pay`, `/api/btcpay/webhook`)                                         | `docs/reference/api.md` | ✅ Covered | Wallet and webhook paths                       |
| Telemetry/admin APIs (`/api/product-session`, `/api/signer-reconnect`, `/api/admin/fx-rates`, `/api/error-metrics`) | `docs/reference/api.md` | ✅ Covered | Product and admin telemetry endpoints          |

---

## Audit Notes

- This matrix is a documentation coverage index, not a behavioral contract.
- Keep it synchronized with route additions under `app/routes/api.*` and major dashboard feature
  areas.
- Update `Last audited` whenever major feature/API areas are added or renamed.
