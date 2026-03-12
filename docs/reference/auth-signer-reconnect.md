# Auth / signer reconnect: risk areas and guards

**Last updated:** 2026-03-12

This document lists known risk areas for the remote signer reconnect flow and points to the modules
that implement guards. It helps reviewers and future contributors avoid regressions.

## Risk areas

| Risk                                | Description                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reconnect loops**                 | Multiple overlapping reconnect attempts; UI or background logic retrying indefinitely.                                                                            |
| **Stale session state**             | A reconnect run that was cancelled or superseded still updates UI (e.g. setState/setError) and overwrites the current run.                                        |
| **Visibility / background**         | App hidden (tab switch, background) during reconnect: in-flight work should be cancelled and not resumed until the app is visible again, with clear resume rules. |
| **Partial failure after reconnect** | Reconnect appears to succeed (e.g. cache populated) but the signer is no longer valid; using it without re-verifying can cause confusing failures.                |

## Where guards live

- **Reconnect loops**
  - **Single in-flight existing reconnect:**
    `app/features/auth/reconnect/useExistingReconnectFlow.client.ts` uses
    `inFlightExistingReconnectRef` so only one “try existing connection” run is active at a time;
    early return if already in flight.
  - **runId before setState after await:** The same hook and the runExisting* modules use a `runId`
    and `getIsRunStale` (or `getCurrentRunId() !== runId`) so that after any `await`, UI updates
    (setState, setError) are skipped when the run is stale. See comments in
    `useExistingReconnectFlow.client.ts` and usage in `reconnect-existing-failure.client.ts` and the
    runExisting* clients.

- **Stale session state**
  - **Stale runId in failure handler:**
    `app/features/auth/reconnect/reconnect-existing-failure.client.ts` checks
    `isExistingReconnectRunStale` first and returns without calling setState/setError if the run is
    stale.
  - **Closed by external reconnect:** The same module skips failure handling when
    `getClosedByExternalReconnect()` is true so we don’t overwrite state after the dialog was
    already closed by a successful external reconnect.

- **Visibility / background**
  - **Cancel on hidden:** `app/features/auth/reconnect/useReconnectVisibilityEffect.client.ts` and
    `app/features/auth/reconnect-lifecycle.client.ts` (`shouldCancelExistingReconnectOnHidden`).
    When the document becomes hidden during `reconnecting_existing`, the visibility effect bumps
    runId, cancels in-flight (cancelRef), and sets state to idle so no stale run can update UI when
    the user returns.
  - **Resume on visible:** The same visibility effect uses `shouldResumeExistingReconnectOnVisible`
    so we only resume existing reconnect when appropriate (e.g. was hidden during reconnect, valid
    session, not already in flight); pending URI resume is handled separately.

- **Partial failure after reconnect**
  - **Verify before use:** `app/features/auth/signer/nostr-signer-connection.client.ts` and
    `app/features/auth/signer/connection-health.client.ts`. After a cache hit, we optionally call
    `verifySignerConnection` before returning the signer; if verification fails we clear the cache
    and return null so the caller doesn’t use a bad signer.
  - **Config staleness in getActiveSigner:** `app/features/auth/signer/connection-resolve.client.ts`
    (and the connection layer) use an `isRequestCurrent()` check after async work; if the config
    changed during connect we return null and do not overwrite the cache.

## Related docs

- [Auth / signer architecture](./auth-signer-architecture.md) — layers, public API, and testing.
