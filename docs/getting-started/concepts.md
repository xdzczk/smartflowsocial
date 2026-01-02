# Core Concepts

**Estimated time:** 20 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Understand the fundamental concepts behind SmartFlowSocial and how everything works together.

---

## Table of Contents

- [What is SmartFlowSocial?](#what-is-smartflowsocial)
- [Nostr Protocol](#nostr-protocol)
- [Architecture Overview](#architecture-overview)
- [Key Concepts](#key-concepts)
- [Data Flow](#data-flow)
- [Security Model](#security-model)
- [How Scheduling Works](#how-scheduling-works)

---

## What is SmartFlowSocial?

SmartFlowSocial is a **self-hosted, professional-grade social media management platform** for the Nostr protocol. It enables you to:

- **Schedule Posts** - Plan content days, weeks, or months in advance
- **Manage Multiple Accounts** - Handle parent/child account relationships
- **Track Engagement** - Monitor replies, mentions, and interactions
- **Bulk Operations** - Upload and schedule multiple posts at once
- **Visual Calendar** - Drag-and-drop scheduling interface
- **Long-form Content** - Publish full articles (NIP-23)

### Key Principles

1. **Privacy-First** - Your keys never leave your browser
2. **Self-Hosted** - Full control over your data and infrastructure
3. **Open Source** - MIT licensed, fully auditable
4. **Professional Features** - Enterprise-level scheduling and management

---

## Nostr Protocol

### What is Nostr?

Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized social protocol that:

- Uses **public-key cryptography** for identity
- Relies on **relays** (servers) to store and forward messages
- Has **no central authority** or single point of failure
- Supports **censorship resistance**

### Key Concepts

#### Public Key (npub)
- Your public identifier (like a username)
- Shareable and public
- Example: `npub1abc123...`

#### Private Key (nsec)
- Your secret key (never share!)
- Used to sign events
- Example: `nsec1xyz789...`

#### Relays
- Servers that store and forward messages
- No single relay is required
- You can use multiple relays

#### Events
- Signed messages you publish
- Types: posts (kind 1), articles (kind 30023), etc.
- Cryptographically signed with your private key

### NIP-07 (Browser Extension)

NIP-07 allows browser extensions to:
- Sign events on your behalf
- Never expose your private key to websites
- Provide secure authentication

**How it works:**
1. Website requests signature
2. Extension prompts you
3. You approve
4. Extension signs event
5. Signed event returned to website

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────┐
│           Browser (Client)              │
│  ┌──────────┐  ┌──────────────────┐   │
│  │  React   │  │  Nostr Extension  │   │
│  │  UI      │  │  (NIP-07)        │   │
│  └────┬─────┘  └────────┬─────────┘   │
└───────┼──────────────────┼─────────────┘
        │                  │
        ▼                  ▼
┌─────────────────────────────────────────┐
│        Remix Server (Application)        │
│  ┌──────────┐  ┌──────────────────┐   │
│  │  Routes  │  │   Background      │   │
│  │ Loaders/ │  │   Worker          │   │
│  │ Actions  │  │   (BullMQ)        │   │
│  └────┬─────┘  └────────┬─────────┘   │
└───────┼──────────────────┼─────────────┘
        │                  │
        ▼                  ▼
┌─────────────────────────────────────────┐
│         Data & Services Layer          │
│  ┌──────────┐  ┌──────────────────┐   │
│  │PostgreSQL│  │      Redis        │   │
│  │ Database │  │     (Queue)       │   │
│  └──────────┘  └──────────────────┘   │
│  ┌──────────┐  ┌──────────────────┐   │
│  │   S3      │  │  Nostr Publisher  │   │
│  │ Storage   │  │   Service         │   │
│  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Remix | Full-stack React framework |
| **Database** | PostgreSQL + Prisma | Data persistence |
| **Queue** | BullMQ + Redis | Background job processing |
| **Storage** | S3-compatible | Image uploads |
| **Authentication** | Nostr (NIP-07) | Decentralized auth |
| **Payments** | Lightning (NWC) | Subscription payments |

---

## Key Concepts

### Posts

**Post** - A piece of content to be published to Nostr.

**Types:**
- **Text Post** - Plain text content
- **Image Post** - Single image with caption
- **Carousel Post** - Multiple images
- **Long-form Post** - Full article (NIP-23)

**States:**
- **Draft** - Work in progress, not scheduled
- **Scheduled** - Queued for future publication
- **Posted** - Published to Nostr relays

### Queues

**Queue** - A scheduling system that controls when posts are published.

**Types:**
- **Interval Queue** - Post every X hours automatically
- **Fixed Time Slots** - Post at specific times daily
- **Manual** - Schedule posts individually

**How it works:**
1. Post assigned to queue
2. Queue calculates next available time slot
3. Post scheduled at that time
4. Worker process publishes at scheduled time

### Templates

**Template** - Reusable post structure with placeholders.

**Use cases:**
- Weekly announcements
- Product launches
- Event promotions
- Recurring content

### Recyclable Posts

**Recyclable Post** - Evergreen content that can be reused.

**Features:**
- Schedule multiple times
- Automatic hashtag rotation
- Time-based reuse rules

---

## Data Flow

### Creating a Post

```
1. User creates post in UI
   ↓
2. User clicks "Schedule" or "Post Now"
   ↓
3. Browser requests signature from Nostr extension
   ↓
4. Extension signs event (client-side)
   ↓
5. Signed event sent to Remix server
   ↓
6. Server validates and stores in database
   ↓
7a. If "Post Now": Published immediately via HTTP Publisher
7b. If "Schedule": Added to queue for later
   ↓
8. HTTP Publisher sends to Nostr relays
   ↓
9. Relays distribute to network
```

### Scheduled Post Publishing

```
1. Post stored in database with scheduled time
   ↓
2. Post added to BullMQ queue (Redis)
   ↓
3. Worker process checks queue periodically
   ↓
4. Worker finds posts due for publishing
   ↓
5. Worker retrieves signed event from database
   ↓
6. Worker sends to HTTP Nostr Publisher
   ↓
7. Publisher sends to Nostr relays
   ↓
8. Post marked as "posted" in database
```

---

## Security Model

### Client-Side Signing

**Principle:** Private keys never leave the browser.

**How it works:**
1. Event created in browser
2. Browser requests signature from extension
3. Extension signs event (key stays in extension)
4. Signed event sent to server
5. Server never sees private key

### Server-Side Validation

**What the server validates:**
- Event signature (cryptographic verification)
- Event structure (valid Nostr event)
- User permissions (authorization)
- Input sanitization (XSS prevention)

### Session Management

**How sessions work:**
1. User logs in with Nostr extension
2. Server creates session cookie
3. Cookie contains user's public key (npub)
4. Server validates session on each request
5. No passwords or tokens stored

---

## How Scheduling Works

### Queue System

**Components:**
- **Database** - Stores posts and schedules
- **Redis** - BullMQ queue storage
- **Worker Process** - Processes scheduled posts

### Scheduling Flow

```
1. User schedules post for "2025-01-20 10:00 AM"
   ↓
2. Post stored in database with scheduled_at timestamp
   ↓
3. Post added to BullMQ queue with delay
   ↓
4. Worker process running in background
   ↓
5. Worker checks queue every minute
   ↓
6. Worker finds post due for publishing
   ↓
7. Worker retrieves signed event
   ↓
8. Worker sends to HTTP Nostr Publisher
   ↓
9. Publisher sends to Nostr relays
   ↓
10. Post marked as "posted" in database
```

### Queue Types

#### Interval Queue
- Posts every X hours automatically
- Calculates next available slot
- Distributes posts evenly

#### Fixed Time Slots
- Posts at specific times daily
- Example: 9 AM, 12 PM, 5 PM
- Respects timezone settings

#### Manual Override
- Schedule posts individually
- Override queue rules
- Full control over timing

---

## Related Documentation

- [Architecture Overview](./architecture.md) - Detailed system design
- [First Steps Guide](./first-steps.md) - Hands-on tutorial
- [Posting Guide](../guides/user-guides/posting.md) - Complete posting guide
- [Nostr Integration](../reference/nostr.md) - Nostr protocol details

---

**Next:** [Architecture Overview](./architecture.md) → Deep dive into system design

