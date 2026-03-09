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

| File / area                                                                                                                                                                                                                                             | Classification       | Suggested home (if Domain)                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| env.server.ts, prisma.server.ts, singleton.server.ts                                                                                                                                                                                                    | Generic              | —                                                                        |
| errors.ts, error-logger.server.ts, error-classification.server.ts, error-aggregation.server.ts, error-handler.\*, error-metrics.server.ts                                                                                                               | Generic              | —                                                                        |
| validation/\*, markdown-sanitizer.server.ts                                                                                                                                                                                                             | Generic              | —                                                                        |
| date.ts, date-range.server.ts, timezones.ts, schedule-formatting.ts, schedule-intervals.ts, schedule-random.ts                                                                                                                                          | Generic              | —                                                                        |
| helpers.ts, utils.ts, icon-constants.ts, fetch.server.ts                                                                                                                                                                                                | Generic              | —                                                                        |
| encryption.server.ts, security.server.ts, rate-limit.server.ts, secrets-sanitizer                                                                                                                                                                       | Generic              | —                                                                        |
| observability-context.server.ts, queue-metrics.server.ts, metrics/\*                                                                                                                                                                                    | Generic              | —                                                                        |
| redis-cache.server.ts, query-batching.server.ts, query-metrics.server.ts                                                                                                                                                                                | Generic              | —                                                                        |
| sentry.server.ts, sentry.client.ts                                                                                                                                                                                                                      | Generic              | —                                                                        |
| correlation-id.client.ts, correlation-context.server.ts                                                                                                                                                                                                 | Generic              | —                                                                        |
| nostr-adapter.client.ts, nostr-adapter.server.ts, nostr-conversion.ts, nostr-client-urls.ts, nostr-timeout-utils.client.ts, extract-nostr-identifier.ts, nostr-circuit-breaker.client.ts, nostr.messenger.server.ts, nostr-session-invariants.server.ts | Domain (Nostr)       | Consider `app/features/nostr/` or keep in lib if shared by many features |
| nostr-signer-manager.client.ts                                                                                                                                                                                                                          | Domain (auth/signer) | `app/features/auth/` (or features/nostr after split)                     |
| remote-signer-sessions\*.client.ts, remote-signer-health.client.ts, primary-signer-failover.client.ts                                                                                                                                                   | Domain (auth/signer) | `app/features/auth/`                                                     |
| push-manager.client.ts, lifecycle-manager.client.ts, safe-console.client.ts                                                                                                                                                                             | Domain / shared      | notifications or keep if used by many                                    |
| useLocalStorage.ts, hooks/useInfiniteScrollSentinel.ts, useIntersectionObserver.ts, useFormattedDate.ts, useSignAttemptProgress.ts, useIsMobile.ts                                                                                                      | Generic (hooks)      | —                                                                        |
| relays.ts                                                                                                                                                                                                                                               | Domain (relays)      | `app/features/relays/` or keep as shared                                 |

## Migration

- Move **Domain** modules into the owning feature (or a shared feature) one at a time. Keep a thin
  re-export in lib only if needed for backward compatibility.
- When adding new code, prefer the feature folder over lib unless the code is clearly generic.
