# Self-hosted Primal cache and engagement

## `get_notifications` must be exposed

The engagement feed uses Primal’s cache request `get_notifications` for **quote reposts** and
**global mentions** (see `app/lib/nostrwebsocket.server.ts` and
`app/features/engagement/services/engagement-loader.server.ts`).

In **primal-caching-service**, only symbols listed in `App.exposed_functions` in `src/app.jl` are
allowed. If `get_notifications` is **not** in that set, the WebSocket handler responds with
`unknown api request` and **no EVENT rows** are returned - so the Mentions tab stays empty even when
the rest of the cache works.

Upstream Primal deployments include this API; older or minimal forks often omit it.

### What to do

1. **Merge upstream** `get_notifications` (and its implementation) into your `app.jl` / storage
   layer, and add `:get_notifications` to `exposed_functions`, **or**
2. Rely on SmartFlow’s **relay fallback** (below).

## Relay fallback (default on)

If `get_notifications` returns **no rows**, SmartFlow queries relays with a NIP-1 filter:

- `kinds: [1]`
- `#p: [your hex pubkey]`

so kind-1 notes that **p-tag** you appear in the Mentions tab (within limits).

**Relays used:** the same list as **Settings → Relays** (`userRelays` on the user account). If that
list is empty or invalid, the app falls back to `MENTIONS_RELAY_FALLBACK_RELAYS` or a small built-in
default list.

### Environment variables

| Variable                                | Default                                | Meaning                                                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MENTIONS_USE_PRIMAL_GET_NOTIFICATIONS` | enabled (`true` unless set to `false`) | Set to `false` to skip the Primal `get_notifications` call entirely (e.g. self-hosted cache with only open-source `App.exposed_functions`). Mentions then come from relay fallback when the global mention list would otherwise be empty. |
| `MENTIONS_RELAY_FALLBACK_ENABLED`       | enabled                                | Set to `false` to disable relay fallback.                                                                                                                                                                                                 |
| `MENTIONS_RELAY_FALLBACK_RELAYS`        | (built-in list)                        | Comma-separated `wss://` URLs used **only** when the user has no usable relays in settings.                                                                                                                                               |
| `ENGAGEMENT_MENTIONS_DEBUG`             | unset                                  | Set to `true` for structured `logWarning` diagnostics (Primal row count, fallback used, etc.).                                                                                                                                            |

Relay fallback runs when the **parsed global mention list is empty** after processing Primal data
(including when `get_notifications` fails, is skipped, or returns rows that yield no mentions). It
only runs when the session resolves to a **64-character hex pubkey** (the `#p` relay filter requires
hex); invalid or missing npub decoding skips the relay round-trip.

It does not replace a full Primal notification index for every edge case.
