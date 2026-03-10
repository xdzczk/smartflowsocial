# Auth / signer architecture

**Last updated:** 2026-03-09

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
  `connection-constants.ts`, `connection-cache.client.ts`, `connection-visibility.client.ts`,
  `connection-health.client.ts`, `connection-connect.client.ts`, `connection-relay-utils.client.ts`,
  with `nostr-signer-connection.client.ts` as the slim orchestrator. Sessions:
  `remote-signer-sessions-types.ts`, `remote-signer-sessions-storage.client.ts`,
  `remote-signer-sessions.client.ts` (API).

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
