# Auth / signer architecture

**Last updated:** 2026-04-19

The auth/signer surface is split into **flow modules**, **composable hooks**, and **signer core** so
that no single file exceeds ~400 lines (logic) or ~300 (UI), flows are testable without React, and
the public API stays stable.

## Layers

- **UI:** `NostrLoginPanel`, `RemoteSignerReconnectController`, `RemoteSignerSettings` (and
  subcomponents such as `RemoteSignerConnectionList`, `RemoteSignerHealthSection`).
- **Hooks:** `useLoginPanelState`, `useNip46Login`, `useReconnectDialogState` — thin orchestration
  over flow modules and React state.
- **Flow modules (pure or thin, no React):**
  - **Reconnect:** `app/features/auth/reconnect/` — `reconnect-existing-nostrconnect.client.ts`,
    `reconnect-existing-bunker.client.ts`, `reconnect-existing-failure.client.ts`. Used by
    `useReconnectDialogState`.
  - **NIP-46 login:** `app/features/auth/nip46/` — `nip46-connect.client.ts` (bunker + Nostr Connect
    URI + pending URI), `nip46-persist.client.ts`. Used by `useNip46Login`.
- **Signer core:** `app/features/auth/signer/` — connection lifecycle split into
  `connection-constants.ts`, `connection-cache.client.ts`, `connection-health.client.ts`,
  `connection-connect.client.ts`, `connection-relay-utils.client.ts`, with
  `nostr-signer-connection.client.ts` as the slim orchestrator. Visibility/resume is intentionally
  unhandled — the shared pool's `enableReconnect` plus the per-sign reconnect-and-retry layer keep
  things alive without bespoke probes. The cached signer is reused as-is on every `getActiveSigner`
  call (no preflight transport check); the next real RPC discovers liveness and the adapter handles
  failures via reconnect-and-retry. This avoids the prior bug where a freshly-cached login signer
  was thrown away because the persisted `cfg.relays` was empty for `bunker_input` configs. Sessions:
  `remote-signer-sessions-types.ts`, `remote-signer-sessions-storage.client.ts`,
  `remote-signer-sessions.client.ts` (API).
- **NIP-46 RPC layer (`Nip46Signer` in `app/features/auth/nostr-signer.client.ts`):** every RPC
  serializes through an internal `rpcLock` and refreshes the inner `BunkerSigner`'s REQ subscription
  before sending the request. `nostr-tools`' `BunkerSigner` keeps a single long-lived REQ that
  drifts in real use (relay reconnect with `since` filters, idle remote signer, etc.) and silently
  drops replies; that's the bug behind "I had to stop & restart the Primal session before the post
  would publish". Mirroring `@nostrify/nostrify`'s `NConnectSigner` pattern (one fresh REQ per RPC)
  guarantees a live listener for the bunker reply on every call. Cold rebuilds via
  `createNip46SignerFromStoredConfig` use `skipValidation: true` so reconstruction is RPC-free — the
  stored bunker pubkey is trusted, the user's first `signEvent` does the only round-trip, and the
  bootstrap warm-up cannot race the user's click for the bunker's response.

## Public API

- **Signer:** `~/features/auth/signer` (or `~/features/auth/signer` index) re-exports from the main
  entry modules only. Internal modules (e.g. `connection-cache.client`, `connection-health.client`)
  are not exported unless a consumer needs them.
- **Auth:** Existing imports from `~/features/auth` and the signer index remain valid; new flow
  modules under `reconnect/` and `nip46/` are implementation details of the hooks.

## Testing

- Flow modules (reconnect-existing-\*, nip46-connect, reconnect-existing-failure) can be unit-tested
  with mocked signer/sessions; no React.
- Connection-health and connection-connect can be tested with mocked storage/sessions.
- Remote-signer-sessions-storage (migration, normalize) and relay utils (`buildRelayUnion`,
  `normalizeRelayList`, `relayListsEqual`) are pure and easy to test.

## Reconnect risk areas and guards

For reconnect loops, stale session state, visibility/background behaviour, and partial failure after
reconnect, see [Auth / signer reconnect: risk areas and guards](./auth-signer-reconnect.md).
