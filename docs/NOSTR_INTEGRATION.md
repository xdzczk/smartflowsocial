# Nostr Integration Guide

This guide covers Nostr protocol integration in SmartFlowSocial, including NIP implementations, event handling, and relay management.

## Table of Contents

- [Overview](#overview)
- [NIP Implementations](#nip-implementations)
- [Authentication (NIP-07)](#authentication-nip-07)
- [Event Types](#event-types)
- [Event Signing](#event-signing)
- [Relay Management](#relay-management)
- [Profile Management](#profile-management)
- [Thread Handling](#thread-handling)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial integrates with the Nostr protocol to enable decentralized social media management. The application uses Nostr for:

- **Authentication**: NIP-07 browser extension authentication
- **Publishing**: Posting content to Nostr relays
- **Profile Management**: Fetching and caching user profiles
- **Engagement**: Tracking replies, mentions, and interactions
- **Long-form Content**: NIP-23 article support

---

## NIP Implementations

### NIP-07: `window.nostr` capability for web browsers

**Status**: ✅ **Fully Implemented**

SmartFlowSocial uses NIP-07 for client-side authentication and event signing.

**Implementation:**
- Users connect via Nostr browser extensions (Alby, nos2x, Amber)
- Events are signed client-side using `window.nostr.signEvent()`
- Private keys never leave the user's browser

**Code Location:**
- `app/lib/nostr.ts` - Event signing functions
- `app/features/auth/components/NostrAuthButton.tsx` - Authentication UI
- `app/routes/nostr-auth.tsx` - Authentication handler

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
- `app/lib/nostr.ts` - `hexToNpub()`, `npubToHex()`
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
- `app/lib/nostr.ts` - `signLongFormEvent()`
- `app/features/posts/services/newlongform-action.server.ts` - Long-form creation
- `app/models/longformpost.server.ts` - Long-form post model

### NIP-01: Basic protocol flow

**Status**: ✅ **Fully Implemented**

Standard Nostr event structure and relay communication.

**Event Kinds Used:**
- `kind: 1` - Short notes/posts
- `kind: 30023` - Long-form articles (NIP-23)

---

## Authentication (NIP-07)

### How It Works

1. **User Clicks Login**
   - Application requests Nostr extension access
   - Extension prompts user for permission

2. **Get Public Key**
   ```typescript
   const pubkey = await window.nostr.getPublicKey();
   ```

3. **Sign Challenge**
   ```typescript
   const event = {
     kind: 1,
     content: "Login challenge",
     created_at: Math.floor(Date.now() / 1000),
     tags: [],
   };
   const signedEvent = await window.nostr.signEvent(event);
   ```

4. **Server Verification**
   - Server verifies signature
   - Creates session
   - Returns authenticated user

### Supported Extensions

- **Alby** - Popular with Lightning wallet integration
- **nos2x** - Lightweight Nostr signer
- **Amber** - Mobile Nostr signer
- **Any NIP-07 compatible extension**

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

Users can configure their preferred relays in settings.

**Default Relays:**
- `wss://relay.primal.net`
- `wss://relay.damus.io`
- `wss://relay.nostr.band`
- `wss://relay.snort.social`

**Code Location:**
- `app/components/settings/RelaysSettings.tsx` - Relay settings UI
- `app/lib/relays.ts` - Relay utilities

### Relay Selection

When publishing:
1. User's configured relays are used
2. If no relays configured, defaults are used
3. Events are published to all specified relays

### Relay Health

Monitor relay health:
- Check connection status
- Track publish success rates
- Fallback to alternative relays if needed

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
- `app/models/user.server.ts` - User model

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

## Additional Resources

- [Nostr Protocol](https://nostr.com/)
- [NIP Repository](https://github.com/nostr-protocol/nips)
- [NIP-07 Specification](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-23 Specification](https://github.com/nostr-protocol/nips/blob/master/23.md)
- [Onboarding Guide](./onboarding.md) - User setup
- [Posting Workflow](./posting.md) - How to create posts

---

## Implementation Status

| NIP | Status | Description |
|-----|--------|-------------|
| NIP-01 | ✅ | Basic protocol flow |
| NIP-07 | ✅ | Browser extension auth |
| NIP-19 | ✅ | bech32 encoding |
| NIP-23 | ✅ | Long-form content |

---

## Future NIPs

Potential future implementations:

- **NIP-26**: Delegated Event Signing
- **NIP-57**: Lightning Zaps
- **NIP-65**: Relay List Metadata
- **NIP-98**: HTTP Auth



