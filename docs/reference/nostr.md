# Nostr Integration Guide

This guide covers Nostr protocol integration in SmartFlowSocial, including NIP implementations,
event handling, and relay management.

## Table of Contents

- [Overview](#overview)
- [NIP Implementations](#nip-implementations) (incl. [NIP-88 polls](#nip-88-polls-kind-1068--1018))
- [Authentication (NIP-07 + NIP-46)](#authentication-nip-07--nip-46)
- [Event Types](#event-types)
- [Event Signing](#event-signing)
- [Relay Management](#relay-management)
- [Profile Management](#profile-management)
- [Thread Handling](#thread-handling)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial integrates with the Nostr protocol to enable decentralized social media management.
The application uses Nostr for:

- **Authentication**: NIP-07 (browser extensions) and NIP-46 (remote signer / Nostr Connect)
- **Publishing**: Posting content to Nostr relays
- **Profile Management**: Fetching and caching user profiles
- **Engagement**: Tracking replies, mentions, and interactions
- **Long-form Content**: NIP-23 article support

---

## NIP Implementations

### NIP-07: `window.nostr` capability for web browsers

**Status**: ✅ **Fully Implemented**

SmartFlowSocial supports NIP-07 for client-side signing (and login via extensions).

**Implementation:**

- Users connect via Nostr browser extensions (Alby, nos2x, Amber)
- Events are signed client-side using `window.nostr.signEvent()`
- Private keys never leave the user's browser

**Code Location:**

- `app/lib/nostr-adapter.client.ts` - Canonical client-side signing adapter
- `app/features/auth/components/NostrLoginPanel.tsx` - Login UI (NIP-07 + NIP-46)
- `app/routes/auth.nostr.challenge.ts` - Login challenge endpoint
- `app/routes/auth.nostr.verify.ts` - Login verification endpoint

### NIP-46: Remote signing (Nostr Connect)

**Status**: ✅ **Implemented (login + signing)**

NIP-46 enables SmartFlowSocial to use a remote signer (“bunker”) instead of a browser extension.

**Profile semantics:** each approved identity is a **pubkey**. Switching profiles means switching
identity and requires re-authentication.

**Code Location:**

- `app/features/auth/nostr-signer.client.ts` - NIP-46 signer wrapper (nostr-tools `BunkerSigner`)
- `app/lib/nostr-signer-manager.client.ts` - Persist/recover the active signer for app-wide signing

### NIP-04 and NIP-17: server-sent direct messages

**Status**: ✅ **Implemented (server)** for automated outbound DMs; ✅ **user-signed** for dashboard
feedback.

Outbound **system** DMs (for example subscription renewal notices) are sent from `NOSTR_NSEC` via
`app/lib/nostr.messenger.server.ts`:

- **NIP-17** ([NIP-17](https://nips.nostr.com/17)): When `NOSTR_DM_NIP17_ENABLED` is on and the
  recipient has a **kind `10050`** event with `relay` tags, the server builds gift-wrapped events
  (NIP-59 / kind `1059`) using `nostr-tools/nip17` and publishes them to the recipient’s (and
  sender’s) inbox relay sets.
- **NIP-04** (kind `4`): Always published after the NIP-17 attempt so clients that only understand
  legacy encrypted DMs still receive the message.

Relay hints use kind `10050` for NIP-17 delivery and kind `10002` (NIP-65) plus
`DEFAULT_USER_WRITE_RELAYS` for the NIP-04 leg.

**Dashboard bug/feature feedback** to `FEEDBACK_INBOX_NPUB` is **not** server-signed: the client
builds a **kind `4`** ciphertext with NIP-04 encryption from the **same identity** as
signing—`window.nostr.nip04` for NIP-07, or the NIP-46 bunker **`nip04_encrypt`** RPC for remote
signers—then signs and POSTs to `/api/feedback-dm`, which verifies and publishes (merged user
execution relays + inbox DM relay hints). When `NOSTR_DM_NIP17_ENABLED` is on and the inbox has
**kind `10050`** relay hints, the client may also build two **user-signed gift wraps (kind `1059`)**
using **`nip44_encrypt`** (remote) or `window.nostr.nip44.encrypt` (extension) for the seal (kind
`13`) plus local ephemeral keys for the wrap; the API validates and publishes each wrap like system
NIP-17 DMs.

### NIP-19: bech32-encoded entities

**Status**: ✅ **Fully Implemented**

Used for encoding/decoding Nostr keys (npub/hex conversion).

**Implementation:**

```typescript
import { nip19 } from "nostr-tools";

// Encode hex to npub
const npub = nip19.npubEncode(hexKey);

// Decode npub to hex
const { data } = nip19.decode(npub);
const hexKey = data as string;
```

**Code Location:**

- `app/lib/nostr-adapter.client.ts` - `encodeNpub()`, `decodeNpub()`
- `app/lib/nostr-adapter.server.ts` - `encodeNpub()`, `decodeNpub()`
- `app/lib/nostr-conversion.ts` - Conversion utilities

### NIP-23: Long-form Content

**Status**: ✅ **Fully Implemented**

SmartFlowSocial supports NIP-23 for publishing long-form articles.

**Event Structure:**

```typescript
{
  kind: 30023, // NIP-23 long-form content
  content: string, // Markdown content
  tags: [
    ["title", "Article Title"],
    ["summary", "Article summary"],
    ["image", "https://..."],
    ["published_at", "1234567890"],
    ["d", "article-identifier"], // Replaceable event identifier
    ["t", "tag1"], // Topic tags
    ["t", "tag2"],
  ],
}
```

**Implementation:**

- Long-form posts use kind `30023`
- Content stored as markdown
- Supports replaceable events (using `d` tag)
- Includes title, summary, image, and tags

**Code Location:**

- `app/lib/nostr-adapter.client.ts` - `signLongFormEvent()`
- `app/features/posts/services/newlongform-action.server.ts` - Long-form creation
- `app/features/posts/data/longformpost.server.ts` - Long-form post data

### NIP-88: Polls (kind 1068 / 1018)

**Status**: ⚠️ **Optional (feature-flagged)** — NIP-88 is still a draft; interoperability with other
clients may vary.

When `NIP88_POLLS_ENABLED` is on, the app can compose and schedule **polls** as kind **`1068`** and
submit **votes** as kind **`1018`**, reusing the same post pipeline as short notes for
publish/schedule.

**Poll event (1068)**

- `content`: question text
- Tags: `option` (id, label), `relay` (at least one URL where votes should be published/read),
  `polltype` (`singlechoice` / `multiplechoice`), optional `endsAt` (unix seconds)

**Vote event (1018)**

- `content`: empty string
- Tags: `e` → poll event id; one or more `response` → option ids from the poll

**Publishing votes via `/api/publish`**

For `kind: 1018`, the JSON body **must** include **`pollEvent`**: the full **signed** kind `1068`
poll the vote references. The server:

1. Cryptographically validates both events (and enforces session pubkey ↔ vote pubkey when
   `ENFORCE_NOSTR_SESSION_PUBKEY` is on).
2. Checks semantic binding (`e` tag, option ids, `endsAt` vs vote `created_at` per in-app rules in
   `~/features/polls`).
3. Publishes the vote to the **union** of the user’s **execution relays** (from
   `resolveExecutionRelays`) and the poll’s **`relay`** tags (deduped, trimmed). Client-supplied
   top-level `relays` are still ignored so relay policy stays server-driven.

Tallies are computed **client-side** by subscribing to the poll’s relay URLs for `kind: 1018` with
`#e` = poll id (see `usePollTally`).

**Code locations**

- `app/features/polls/` — parse/build/validate/aggregate
- `app/routes/api.publish.tsx` — vote publish + relay merge
- `app/lib/nostr-adapter.client.ts` — `signPollEventWithOneRetry`

**Spec**

- [NIP-88 (draft)](https://nips.nostr.com/88)

### NIP-01: Basic protocol flow

**Status**: ✅ **Fully Implemented**

Standard Nostr event structure and relay communication.

**Event Kinds Used:**

- `kind: 1` - Short notes/posts
- `kind: 1068` - Polls (NIP-88, when enabled)
- `kind: 1018` - Poll votes (NIP-88, when enabled)
- `kind: 30023` - Long-form articles (NIP-23)

---

## Authentication (NIP-07 + NIP-46)

### How It Works

1. **User starts sign-in**
   - User navigates to `/login`
   - App proactively checks for NIP-07 extension availability
   - User explicitly chooses **Browser Extension (NIP-07)** or **Remote Signer (NIP-46)**

2. **Resolve identity pubkey**
   - NIP-07: `window.nostr.getPublicKey()` (with circuit breaker protection)
   - NIP-46: connect/approve in the remote signer, then `getPublicKey()` (with progressive timeouts)

   ```typescript
   const pubkey = await window.nostr.getPublicKey();
   ```

3. **Request server challenge**
   - `POST /auth/nostr/challenge` returns `{ challengeId, nonce, expiresAt }`

4. **Sign canonical login message (kind 27235)**
   - Client builds a deterministic message and signs it with the chosen signer
   - Uses progressive timeouts for NIP-46 connections

   ```typescript
   const event = {
     kind: 27235,
     content: canonicalLoginMessage({ nonce, expiresAt }),
     created_at: Math.floor(Date.now() / 1000),
     tags: [],
   };
   const signedEvent = await signer.signEvent(event);
   ```

5. **Server verification**
   - `POST /auth/nostr/verify` verifies:
     - challenge exists, not expired, not consumed
     - signature is valid
     - `signedEvent.pubkey` matches declared `pubkey`
   - Server creates a DB-backed session bound to the pubkey and sets a cookie

### Connection Management

**Progressive Timeouts:**

- First attempt: 120 seconds (2 minutes)
- Retry 1: 60 seconds (1 minute)
- Retry 2: 30 seconds
- Prevents indefinite waiting on retries

**Circuit Breaker:**

- Tracks consecutive failures per signer type
- After 3 failures: 30-second cooldown
- Prevents hammering failed connections
- Automatically resets on success

**Health Monitoring:**

- Periodic health checks every 30 seconds
- Quick validation before critical operations
- Automatic reconnection on stale connections
- Connection age tracking (5-minute inactivity threshold)

**Mobile Optimizations:**

- Cooldown period after app becomes visible (iOS: 1.5s, Android: 0.8s)
- Automatic retry with exponential backoff
- App switching detection and auto-resume
- Progress indicators during connection attempts

### Rollout / feature flags

SmartFlowSocial supports staged rollout and emergency toggles via environment variables:

- **`NOSTR_AUTH_V2_ENABLED`** (default: `true`)
  - When disabled, the server will return `404` for:
    - `POST /auth/nostr/challenge`
    - `POST /auth/nostr/verify`
- **`ENFORCE_NOSTR_SESSION_PUBKEY`** (default: `true`)
  - When enabled, the server rejects any incoming signed event where the event `pubkey` does not
    match the authenticated session pubkey, returning a `PROFILE_MISMATCH` error.

### Legacy endpoint

The legacy authentication endpoint **`POST /nostr-auth` has been removed**. Clients must sign in via
`/login` using the challenge/verify endpoints above.

### Connection Quality Metrics

SmartFlowSocial tracks connection quality metrics (anonymized, stored locally) to:

- Adjust timeouts based on historical success rates
- Prefer connection methods with better success rates
- Provide user hints based on common failure patterns
- Enable data-driven improvements

Metrics include:

- Connection success rate by platform (iOS/Android/Desktop)
- Average connection time by method
- Failure reasons distribution
- Retry success rates

### Supported signers

- **Alby** - Popular with Lightning wallet integration
- **nos2x** - Lightweight Nostr signer
- **Amber** - Mobile Nostr signer
- **Any NIP-07 compatible extension**
- **NIP-46 remote signers** (“bunkers”)

### Code Example

```typescript
// Client-side signing
const signEventFn = async (eventData: NostrEventData) => {
  if (!window.nostr) {
    throw new Error("Nostr extension not found");
  }

  const nostrEvent: NostrEvent = {
    content: eventData.content,
    created_at: eventData.created_at,
    kind: eventData.kind || 1,
    tags: eventData.tags || [],
  };

  const signResult = await window.nostr.signEvent(nostrEvent);

  return {
    nostrEvent,
    signedEvent: {
      ...nostrEvent,
      id: signResult.id,
      pubkey: signResult.pubkey,
      sig: signResult.sig,
    },
  };
};
```

---

## Event Types

### Short Notes (Kind 1)

Standard Nostr posts/notes.

**Structure:**

```typescript
{
  kind: 1,
  content: "Post content here",
  created_at: 1234567890,
  tags: [
    ["p", "pubkey"], // Mentions
    ["e", "event-id"], // Replies
    ["t", "hashtag"], // Hashtags
  ],
}
```

**Usage:**

- Regular posts
- Scheduled posts
- Recyclable posts

### Long-form Articles (Kind 30023)

NIP-23 long-form content.

**Structure:**

```typescript
{
  kind: 30023,
  content: "# Article Title\n\nArticle content...",
  created_at: 1234567890,
  tags: [
    ["title", "Article Title"],
    ["summary", "Article summary"],
    ["image", "https://cover-image.jpg"],
    ["published_at", "1234567890"],
    ["d", "article-slug"], // Replaceable event identifier
    ["t", "topic1"],
    ["t", "topic2"],
  ],
}
```

**Features:**

- Replaceable events (can be updated)
- Rich content (markdown)
- Cover images
- Topic tags

---

## Event Signing

### Client-Side Signing

All events are signed client-side using NIP-07:

```typescript
// Regular post
const signedEvent = await signEventFn({
  content: "Post content",
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
});

// Long-form post
const signedEvent = await signLongFormEvent({
  title: "Article Title",
  content: "# Article\n\nContent...",
  summary: "Article summary",
  image: "https://cover.jpg",
  tags: ["tag1", "tag2"],
  identifier: "article-slug",
});
```

### Server-Side Publishing

Signed events are sent to HTTP Nostr Publisher:

```typescript
const response = await fetch(process.env.NOSTR_PUBLISHER_URL!, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    relays: user.userRelays,
    event: signedEvent,
  }),
});
```

### Rescheduling

When posts are rescheduled:

1. Original signed event is cleared
2. New timestamp is set
3. User must re-sign with new timestamp
4. Event is re-published to relays

---

## Relay Management

### User Relay Configuration

Users can configure their preferred **write relays** (relay intent) in settings.

Relay intent is persisted in `User.userRelays` and is **not** mutated by execution-time health
logic.

**Default Relays:**

- `wss://relay.bullishbounty.com`
- `wss://relay.snort.social`
- `wss://relay.primal.net`
- `wss://relay.damus.io`
- `wss://relay.nostr.band`

**Code Location:**

- `app/components/settings/RelaysSettings.tsx` - Relay settings UI
- `app/lib/relays.ts` - Relay defaults + constants
- `app/features/relays/relay-resolution.server.ts` - Canonical relay resolution (direct intent +
  managed relays)

### Managed Relays (Blastr)

SmartFlowSocial may include a **managed fan-out relay** (Blastr) during publishing.

- **Not persisted** as a string in `User.userRelays`
- **Feature-gated** via `Plan.enableRelayBlast` (active subscription required)
- **Resolved server-side** by the canonical relay resolver

### Canonical Relay Resolution (required)

All publishing entrypoints must resolve relays server-side via:

- `getRelayIntent(userId)` (persisted intent; defaults if empty)
- `getEffectiveWriteRelays(userId)` (direct intent + managed relays)
- `resolveExecutionRelays(userId)` (flattened list for publishing)

### Relay Selection

When publishing:

1. Server resolves **effective relays** (managed + direct intent)
2. Publisher performs **ephemeral execution planning** (health-based ordering/circuit breakers)
3. Events are published to the execution relay list

**Important:** `/api/publish` derives relays server-side; client-provided relay lists are ignored by
default.

### Relay Health

Monitor relay health:

- Check connection status
- Track publish success rates
- Fallback to alternative relays if needed

**Code Location:**

- `app/infra/relays/relay-health.server.ts` - Health scoring + circuit breaker
- `app/infra/publishers/nostr-publisher.server.ts` - Applies health-aware execution planning

### Relay ACK Persistence

Per-relay publish outcomes are persisted for observability in:

- `PublishRelayAck` (keyed by `publishAttemptId` + `relayUrl`)

---

## Profile Management

### Profile Fetching

Profiles are fetched from Primal caching service:

```typescript
// Fetch profile
const profile = await getCompleteProfile({ npub });

// Profile structure
{
  npub: "npub1...",
  name: "User Name",
  displayName: "Display Name",
  about: "Bio text",
  picture: "https://avatar.jpg",
  banner: "https://banner.jpg",
  // ... other fields
}
```

### Profile Caching

Profiles are cached in database:

- Stored in `User.nostrProfile` (JSON field)
- Updated periodically
- Used for display without fetching

**Code Location:**

- `app/features/nostr/types.ts` - Profile types
- `app/features/auth/profile.server.ts` - Profile fetching
- User data via `~/features/user` - User feature

---

## Thread Handling

### Reply Structure

Replies use standard Nostr reply structure:

```typescript
{
  kind: 1,
  content: "Reply content",
  tags: [
    ["e", "root-event-id", "relay-url"], // Root event
    ["e", "reply-to-event-id", "relay-url"], // Direct reply
    ["p", "author-pubkey"], // Mention author
  ],
}
```

### Thread View

Thread views are fetched from Primal cache:

```typescript
// Fetch thread
const thread = await fetchThreadView(eventId);

// Returns:
{
  rootEvent: { ... },
  events: [
    { ... }, // Reply 1
    { ... }, // Reply 2
  ],
}
```

**Code Location:**

- `app/routes/api.thread-view.tsx` - Thread fetching endpoint
- `app/features/engagement/engagement.server.ts` - Engagement handling

---

## Best Practices

### 1. Event Signing

- ✅ Always sign events client-side
- ✅ Never store private keys on server
- ✅ Re-sign events when timestamps change
- ✅ Validate signatures before publishing

### 2. Relay Management

- ✅ Allow users to configure their relays
- ✅ Provide sensible defaults
- ✅ Support multiple relays for redundancy
- ✅ Monitor relay health

### 3. Profile Handling

- ✅ Cache profiles to reduce API calls
- ✅ Update profiles periodically
- ✅ Handle missing profiles gracefully
- ✅ Use Primal cache for performance

### 4. Error Handling

- ✅ Handle extension not found errors
- ✅ Handle signing failures
- ✅ Handle relay connection errors
- ✅ Provide user-friendly error messages

### 5. Security

- ✅ Never request private keys
- ✅ Validate all event data
- ✅ Sanitize user content
- ✅ Verify signatures server-side

---

## Troubleshooting

### Extension Not Found

**Error**: "Nostr extension not found"

**Solutions:**

1. Check if extension is installed
2. Refresh page
3. Check extension permissions
4. Try different extension

### Signing Failures

**Error**: "Failed to sign event"

**Solutions:**

1. Check extension is unlocked
2. Verify extension permissions
3. Check event structure
4. Try signing again

### Relay Connection Issues

**Error**: "Failed to publish to relay"

**Solutions:**

1. Check relay URL format
2. Verify relay is accessible
3. Try alternative relays
4. Check network connectivity

---

## See Also

- [Posting Guide](../guides/user-guides/posting.md) - How to create and publish posts
- [Calendar Guide](../guides/user-guides/calendar.md) - Scheduling posts
- [API Reference](../reference/api.md) - API endpoints for Nostr
- [Architecture Guide](../getting-started/architecture.md) - System architecture

## Additional Resources

- [Nostr Protocol](https://nostr.com/)
- [NIP Repository](https://github.com/nostr-protocol/nips)
- [NIP-07 Specification](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-23 Specification](https://github.com/nostr-protocol/nips/blob/master/23.md)
- [NIP-88 Polls (draft)](https://nips.nostr.com/88)
- [Hosted Quick Start](../getting-started/hosted.md) - Getting started with hosted service
- [Posting Guide](../guides/user-guides/posting.md) - How to create posts

---

## Implementation Status

| NIP    | Status | Description             |
| ------ | ------ | ----------------------- |
| NIP-01 | ✅     | Basic protocol flow     |
| NIP-07 | ✅     | Browser extension auth  |
| NIP-46 | ✅     | Remote signer auth      |
| NIP-19 | ✅     | bech32 encoding         |
| NIP-23 | ✅     | Long-form content       |
| NIP-88 | ⚠️     | Polls (feature-flagged) |

---

## Future NIPs

Potential future implementations:

- **NIP-26**: Delegated Event Signing
- **NIP-57**: Lightning Zaps
- **NIP-65**: Relay List Metadata
- **NIP-98**: HTTP Auth
