# app/lib Audit: Generic vs Domain

**Last updated:** 2026-03-09

`app/lib` should contain only **generic, shared utilities** (validation, env, temporal, logging,
etc.). Domain-specific code belongs in features. This doc classifies current modules to guide
incremental moves.

## Rule

**Generic:** No domain knowledge, reusable across features (date utils, env, validation helpers,
error-logger).  
**Domain:** Clearly belongs to one feature (e.g. Nostr signer → auth/nostr; push → notifications).
Suggested home is the owning feature or a shared feature (e.g. `app/features/nostr/`) if multiple
features need it.

## Classification (summary)

| File / area                                                                                                                                                                                                                                             | Classification                  | Suggested home (if Domain)                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| env.server.ts, prisma.server.ts, singleton.server.ts                                                                                                                                                                                                    | Generic                         | -                                                                                                                   |
| errors.ts, error-logger.server.ts, error-classification.server.ts, error-aggregation.server.ts, error-handler.\*, error-metrics.server.ts                                                                                                               | Generic                         | -                                                                                                                   |
| validation/\*, markdown-sanitizer.server.ts                                                                                                                                                                                                             | Generic                         | -                                                                                                                   |
| date.ts, date-range.server.ts, timezones.ts, schedule-formatting.ts, schedule-intervals.ts, schedule-random.ts                                                                                                                                          | Generic                         | -                                                                                                                   |
| helpers.ts, utils.ts, icon-constants.ts, fetch.server.ts                                                                                                                                                                                                | Generic                         | -                                                                                                                   |
| encryption.server.ts, security.server.ts, rate-limit.server.ts, secrets-sanitizer                                                                                                                                                                       | Generic                         | -                                                                                                                   |
| observability-context.server.ts, queue-metrics.server.ts, metrics/\*                                                                                                                                                                                    | Generic                         | -                                                                                                                   |
| redis-cache.server.ts, query-batching.server.ts, query-metrics.server.ts                                                                                                                                                                                | Generic                         | -                                                                                                                   |
| sentry.server.ts, sentry.client.ts                                                                                                                                                                                                                      | Generic                         | -                                                                                                                   |
| correlation-id.client.ts, correlation-context.server.ts                                                                                                                                                                                                 | Generic                         | -                                                                                                                   |
| nostr-adapter.client.ts, nostr-adapter.server.ts, nostr-conversion.ts, nostr-client-urls.ts, nostr-timeout-utils.client.ts, extract-nostr-identifier.ts, nostr-circuit-breaker.client.ts, nostr.messenger.server.ts, nostr-session-invariants.server.ts | **Nostr shared** (lib boundary) | Kept in lib: used by auth, posts, upload, payments; no single owner. Optional future move to `app/features/nostr/`. |
| nostr-signer-manager, nostr-signer-connection, nostr-signer-keys, nostr-signer-storage, remote-signer-sessions\*, remote-signer-health, remote-signer-reconnect, primary-signer-failover, primary-signer-profile                                        | **Moved**                       | `app/features/auth/signer/`                                                                                         |
| push-manager.client.ts                                                                                                                                                                                                                                  | **Moved**                       | `app/features/notifications/push-manager.client.ts`                                                                 |
| lifecycle-manager.client.ts                                                                                                                                                                                                                             | **Moved**                       | `app/features/auth/lifecycle-manager.client.ts`                                                                     |
| safe-console.client.ts                                                                                                                                                                                                                                  | Generic                         | Stays in lib (logging guard; no domain concept)                                                                     |
| useLocalStorage.ts, hooks/useInfiniteScrollSentinel.ts, useIntersectionObserver.ts, useFormattedDate.ts, useSignAttemptProgress.ts, useIsMobile.ts                                                                                                      | Generic (hooks)                 | -                                                                                                                   |
| relays.ts                                                                                                                                                                                                                                               | **Moved**                       | `app/features/relays/relay-constants.ts` (lib/relays.ts removed)                                                    |

## Nostr shared (lib boundary)

The following modules remain in lib as a **documented shared exception**: they have no single owner
and are used by auth, posts, upload, payments, etc. They contain no auth/signer UI or session state.

- nostr-adapter.client.ts, nostr-adapter.server.ts, nostr-conversion.ts, nostr-client-urls.ts
- nostr-timeout-utils.client.ts, extract-nostr-identifier.ts, nostr-circuit-breaker.client.ts
- nostr.messenger.server.ts, nostr-session-invariants.server.ts

Optional future move: expand `app/features/nostr/` and move these there; then update all imports and
remove from lib.

## Migration

- Move **Domain** modules into the owning feature (or a shared feature) one at a time. Keep a thin
  re-export in lib only if needed for backward compatibility.
- When adding new code, prefer the feature folder over lib unless the code is clearly generic.
- **Completed moves:** auth/signer cluster → `features/auth/signer/`; relays →
  `features/relays/relay-constants`; push-manager → `features/notifications/`; lifecycle-manager →
  `features/auth/`.
