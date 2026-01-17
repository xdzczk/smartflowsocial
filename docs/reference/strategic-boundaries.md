# Strategic Boundaries

**Last Updated:** 2025-01-02  
**Status:** Active

This document defines what SmartFlowSocial **is** and what it **is not**. It establishes what we're
willing to be "bad at" to maintain focus on our core value proposition.

---

## Core Principle

**SmartFlowSocial is a scheduling and content management tool, not a social network client.**

Our strength is **intentional publishing**, not **social consumption**.

---

## What We Are

### Core Identity

**SmartFlowSocial is:**

- A **professional scheduling platform** for Nostr
- A **content management system** for decentralized social
- A **publishing workflow tool** for creators and businesses
- A **planning and organization tool** for social media presence

### Core Value Proposition

**We excel at:**

1. **Scheduling** - Plan content days, weeks, or months in advance
2. **Content Management** - Organize drafts, templates, and reusable content
3. **Queue Management** - Automate posting schedules with intervals and fixed slots
4. **Bulk Operations** - Upload and schedule multiple posts efficiently
5. **Calendar View** - Visual drag-and-drop scheduling interface
6. **Reliable Publishing** - Guaranteed delivery with retry logic and idempotency

---

## What We Are Not

### We Are Not

1. **A Nostr Client** - We don't compete with native Nostr clients (Amethyst, Damus, Snort, etc.)
2. **A Feed Reader** - We don't provide comprehensive feed browsing
3. **A Reply Interface** - We don't provide native reply threading
4. **A Social Network** - We don't build social features (follows, profiles, etc.)
5. **An Analytics Platform** - Analytics are convenience features, not core

---

## Strategic Boundaries

### Boundary 1: Feed Browsing

**We are willing to be worse than Primal Studio at feed browsing.**

**Rationale:**

- Feed browsing is not our core value
- Native clients excel at this
- Users can use native clients for consumption
- We focus on publishing, not consumption

**What this means:**

- Engagement feed is a **convenience feature**, not core
- We show engagement for **publishing context**, not for consumption
- We don't build comprehensive feed browsing
- We don't compete with feed readers

**Acceptable limitations:**

- Limited feed browsing capabilities
- Basic engagement tracking (not comprehensive)
- No real-time feed updates
- No advanced feed filtering

---

### Boundary 2: Native Client Features

**We are willing to be worse than native Nostr clients at replies, threading, and real-time
interactions.**

**Rationale:**

- Native clients are optimized for real-time interaction
- We focus on planned, scheduled content
- Real-time features are not our strength
- Users can use native clients for interaction

**What this means:**

- Reply functionality is **basic**, not advanced
- No real-time threading
- No advanced interaction features
- We don't compete with native clients

**Acceptable limitations:**

- Basic reply functionality
- No advanced threading
- No real-time notifications
- Limited interaction features

---

### Boundary 3: Social Consumption

**We are willing to be worse at social consumption features.**

**Rationale:**

- Our strength is **publishing**, not **consumption**
- Social consumption is better handled by native clients
- We focus on content creation and scheduling
- Consumption features dilute our focus

**What this means:**

- Engagement feed is for **context**, not consumption
- We don't build comprehensive social features
- We don't compete with social networks
- We focus on publishing workflow

**Acceptable limitations:**

- Limited social consumption features
- Basic engagement tracking
- No comprehensive social graph
- No advanced social features

---

### Boundary 4: Analytics

**Analytics are convenience features, not core.**

**Rationale:**

- Analytics help users understand their publishing
- But analytics are not why users choose SmartFlowSocial
- Core value is scheduling and content management
- Analytics are "nice to have", not "must have"

**What this means:**

- Basic analytics are sufficient
- We don't need to compete with analytics platforms
- Analytics support publishing decisions
- But analytics are not the core value

**Acceptable limitations:**

- Basic analytics (not comprehensive)
- No advanced analytics features
- No real-time analytics
- Analytics are convenience, not core

---

## Core vs Nice-to-Have

### Core Features (Must Excel)

1. **Scheduling** - Calendar, queues, intervals, fixed slots
2. **Content Management** - Drafts, templates, recyclables
3. **Bulk Operations** - Upload, schedule multiple posts
4. **Reliable Publishing** - Guaranteed delivery, retry logic
5. **Queue Management** - Organize and automate posting
6. **Long-form Content** - Article publishing (NIP-23)

**These are non-negotiable. We must excel at these.**

---

### Nice-to-Have Features (Convenience)

1. **Engagement Feed** - Track replies, mentions (for context)
2. **Analytics** - Basic metrics (for publishing decisions)
3. **Giveaways** - Native Nostr giveaways (marketing tool)
4. **Search** - Find events to quote/repost (publishing tool)
5. **Multi-Account** - Parent/child accounts (organization)

**These are helpful but not core. We can be "good enough" at these.**

---

### Not Our Focus (Willing to Be Bad)

1. **Feed Browsing** - Comprehensive feed reading
2. **Real-time Interaction** - Advanced reply threading
3. **Social Graph** - Follows, followers, social features
4. **Advanced Analytics** - Comprehensive analytics platform
5. **Native Client Features** - Real-time notifications, advanced UI

**We explicitly don't compete in these areas.**

---

## Product Strategy

### What Users Should Use SmartFlowSocial For

- **Planning content** - Schedule posts days/weeks in advance
- **Managing drafts** - Organize work-in-progress content
- **Bulk scheduling** - Upload and schedule multiple posts
- **Queue management** - Automate posting schedules
- **Content organization** - Templates, recyclables, hashtag presets
- **Reliable publishing** - Guaranteed delivery with retry logic

### What Users Should Use Native Clients For

- **Feed browsing** - Reading and consuming content
- **Real-time interaction** - Replies, threading, conversations
- **Social features** - Follows, followers, social graph
- **Advanced UI** - Native client features and optimizations

---

## Decision Framework

### When Evaluating New Features

**Ask:**

1. Does this support **intentional publishing**?
2. Does this help with **content management**?
3. Does this improve **scheduling workflow**?
4. Or is this a **consumption/social feature**?

**If it's consumption/social:**

- Is it necessary for publishing context? (e.g., engagement feed for context)
- Or is it competing with native clients? (e.g., comprehensive feed browsing)

**Decision rule:**

- **Core publishing features** → Build and excel
- **Publishing context features** → Build but keep simple
- **Consumption/social features** → Don't build (or keep minimal)

---

## Examples

### ✅ Good: Engagement Feed (Context)

**Why it's acceptable:**

- Helps users understand engagement for **publishing decisions**
- Provides context for **content strategy**
- Not competing with native clients (basic, not comprehensive)
- Supports publishing workflow

**Limitations we accept:**

- Basic engagement tracking (not comprehensive)
- No real-time updates
- Limited filtering
- Convenience feature, not core

---

### ❌ Bad: Comprehensive Feed Browsing

**Why we don't build it:**

- Competes with native clients
- Not core to publishing workflow
- Dilutes focus on scheduling
- Users can use native clients

**What we do instead:**

- Basic search for events to quote/repost
- Engagement feed for context (not consumption)
- Focus on publishing, not consumption

---

### ✅ Good: Basic Reply Functionality

**Why it's acceptable:**

- Helps users respond to engagement
- Supports publishing workflow
- Basic functionality is sufficient
- Not competing with native clients

**Limitations we accept:**

- Basic reply (not advanced threading)
- No real-time notifications
- Limited interaction features
- Convenience feature, not core

---

### ❌ Bad: Advanced Reply Threading

**Why we don't build it:**

- Native clients excel at this
- Not core to publishing workflow
- Real-time features are not our strength
- Users can use native clients

**What we do instead:**

- Basic reply functionality
- Focus on scheduled responses
- Support publishing workflow, not real-time interaction

---

## Competitive Positioning

### We Compete With

- **Buffer** - Social media scheduling (but for Nostr)
- **Hootsuite** - Social media management (but decentralized)
- **Later** - Content scheduling (but for Nostr)

### We Don't Compete With

- **Primal Studio** - Feed browsing (we're worse, and that's OK)
- **Amethyst** - Native Nostr client (we're not a client)
- **Damus** - Mobile Nostr client (we're not a mobile app)
- **Snort** - Web Nostr client (we're not a web client)

**Our competitive advantage:**

- **Intentional publishing** - We excel at planning and scheduling
- **Reliable delivery** - Guaranteed publishing with retry logic
- **Content management** - Organize and manage content efficiently
- **Professional workflow** - Enterprise-level scheduling features

---

## Future Considerations

### If We Add Features

**Questions to ask:**

1. Does this support **intentional publishing**?
2. Does this help with **content management**?
3. Does this improve **scheduling workflow**?
4. Or is this a **consumption/social feature**?

**If consumption/social:**

- Is it necessary for publishing context?
- Or is it competing with native clients?

**Decision:**

- Publishing context → Build but keep simple
- Competing with native clients → Don't build

---

### Potential Feature Requests

**"Can we add comprehensive feed browsing?"**

- ❌ No - Competes with native clients, not core to publishing

**"Can we add advanced reply threading?"**

- ❌ No - Native clients excel at this, not our strength

**"Can we add real-time notifications?"**

- ❌ No - Real-time features are not our focus

**"Can we add advanced analytics?"**

- ⚠️ Maybe - If it supports publishing decisions, but keep it simple

**"Can we add better engagement tracking?"**

- ✅ Yes - If it provides context for publishing decisions

---

## Operational Guarantees

### What We Promise

1. **Excellent scheduling** - Best-in-class scheduling features
2. **Reliable publishing** - Guaranteed delivery with retry logic
3. **Content management** - Organize and manage content efficiently
4. **Professional workflow** - Enterprise-level features

### What We Don't Promise

1. **Comprehensive feed browsing** - Use native clients
2. **Advanced reply threading** - Use native clients
3. **Real-time interaction** - Use native clients
4. **Advanced analytics** - Basic analytics are sufficient

---

## Revision History

- **2025-01-02**: Initial strategic boundaries document created

---

**This is a living document. Update it as product strategy evolves.**

**Remember: Our strength is intentional publishing, not social consumption.**
