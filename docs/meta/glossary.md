# Glossary

**Last updated:** 2026-11-09

Terminology and definitions for SmartFlowSocial.

---

## A

### API

Application Programming Interface. Endpoints that allow programmatic access to SmartFlowSocial
functionality.

### Authentication

The process of verifying user identity using Nostr signatures (NIP-07).

---

## B

### Blossom

The [Blossom](https://github.com/hzrd149/blossom) media protocol, and SmartFlowSocial's gateway for
it ([smartflowsocial-blossom](https://github.com/xdzczk/smartflowsocial-blossom)). Uploads are
token-based and quota-tracked.

### Blastr

SmartFlowSocial's managed fan-out relay
([smartflowsocial-blastr](https://github.com/xdzczk/smartflowsocial-blastr)). Publishing can include
it when the plan allows. It is not stored as one of the user's relay URLs.

### Bunker

A NIP-46 remote signer. Connection strings use the `bunker://` URI, and the client uses nostr-tools'
`BunkerSigner`. In these docs, "remote signer" and "bunker" are that same connection.

### BullMQ

A Redis-based queue system used for processing background jobs, including scheduled post publishing.

---

## C

### Carousel Post

A post containing multiple images displayed in a carousel format.

### Client-Side Signing

The process of signing Nostr events in the browser using a Nostr extension, ensuring private keys
never leave the browser.

---

## D

### Draft

A post that is saved but not yet scheduled or published.

---

## E

### Engagement

Interactions with your posts, including replies, mentions, reactions, and reposts.

### Event

A signed message in the Nostr protocol. Posts are published as events to relays.

---

## F

### Fixed Time Slots

A queue type that schedules posts at specific times daily (e.g., 9 AM, 12 PM, 5 PM).

---

## I

### Interval Queue

A queue type that schedules posts at regular intervals (e.g., every 6 hours).

---

## L

### Long-form Post

A full article post (NIP-23) with rich text formatting, supporting extended content.

---

## M

### Mention

When someone references your Nostr public key (npub) in a post.

---

## N

### NIP-07

A Nostr Improvement Proposal that defines browser extension authentication for Nostr.

### NIP-46

A Nostr Improvement Proposal that defines remote signer protocol: the app communicates with an
external signer (e.g. another device or service) to sign events without the private key in the
browser. Used for "remote signer" or "signer profile" flows in SmartFlowSocial.

### NIP-23

A Nostr Improvement Proposal that defines long-form article posts.

### Nostr

Notes and Other Stuff Transmitted by Relays - a decentralized social protocol.

### npub

Nostr public key - your public identifier on Nostr.

### nsec

Nostr secret key - your private key (never share!).

### NWC

Nostr Wallet Connect - a protocol for connecting Lightning wallets via Nostr.

---

## P

### Post

A piece of content to be published to Nostr, which can be text, images, or long-form articles.

### Prisma

An ORM (Object-Relational Mapping) tool used for database access in SmartFlowSocial.

---

## Q

### Queue

A scheduling system that controls when posts are published. Types include interval queues and fixed
time slots.

---

## R

### Recyclable Post

Content that can be reused and scheduled again. Older pages call this evergreen content. Prefer
recyclable.

### Relay

A server in the Nostr network that stores and forwards events (messages).

### Remix

A full-stack React framework used to build SmartFlowSocial.

---

## S

### Scheduled Post

A post that is queued for future publication at a specific date and time.

### Session

A server-side session cookie that maintains user authentication state.

---

## T

### Template

A reusable post structure with placeholders (variables) for dynamic content.

---

## Related Documentation

- [Core Concepts](../getting-started/concepts.md) - Understanding the system
- [Common Tasks](./common-tasks.md) - Quick reference
- [Architecture Overview](../getting-started/architecture.md) - System design

---

**Next:** [Style Guide](./style-guide.md) → Documentation standards
