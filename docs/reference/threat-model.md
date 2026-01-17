# Threat Model & Trust Boundaries

**Last Updated:** 2025-01-02  
**Status:** Active

This document defines what SmartFlowSocial knows about users, what it doesn't need to know, and what
happens if various components are compromised.

---

## Core Principle

**SmartFlowSocial is a scheduling tool, not a social network.** We store the minimum necessary to
provide scheduling services. We do not store private keys, and we minimize correlation data.

---

## What We Store

### 1. User Identity Data

**Stored:**

- `npub` (Nostr public key) - **Public by design** (Nostr public keys are meant to be public)
- `id` (internal CUID) - **Internal only**
- `timezone` - **Semi-sensitive** (reveals approximate location)
- `createdAt`, `updatedAt` - **Low sensitivity** (timing metadata)

**Why we need it:**

- `npub`: Required for Nostr protocol operations
- `timezone`: Required for accurate scheduling
- `id`: Internal database reference

**What we don't store:**

- Private keys (never stored, never transmitted to server)
- Email addresses
- Phone numbers
- Real names (unless user publishes via Nostr profile)

---

### 2. Post Content Data

**Stored:**

- `content`, `caption` - **Sensitive** (user's unpublished content)
- `fileUrl` - **Sensitive** (links to user's media)
- `signedEvent` - **Highly sensitive** (cryptographically signed Nostr event)
- `nostrEvent` - **Sensitive** (unsigned event structure)
- `scheduledAtUtc` - **Semi-sensitive** (reveals posting schedule patterns)
- `tags`, `hashtags` - **Low sensitivity** (will be public anyway)

**Why we need it:**

- Content: Required to schedule posts
- Signed event: Required to publish to Nostr (must be signed client-side)
- Scheduled time: Core functionality

**What we don't store:**

- Private keys (events are signed client-side)
- Draft content after deletion (cascade delete)

**Privacy implications:**

- **Drafts are sensitive** - They represent unpublished thoughts
- **Signed events are sensitive** - They contain cryptographic signatures tied to user's identity
- **Scheduling patterns are semi-sensitive** - Reveal user behavior patterns

---

### 3. Configuration & Preferences

**Stored:**

- `userRelays` - **Low sensitivity** (public relay URLs)
- `scheduleInterval` - **Low sensitivity** (user preference)
- `showHashTagsinPosts` - **Low sensitivity** (preference)
- `uploadProvider` - **Low sensitivity** (technical choice)
- `queueTypes` - **Semi-sensitive** (reveals content organization)
- `hashTagPresets` - **Low sensitivity** (user-created tags)
- `templates` - **Semi-sensitive** (user-created content templates)

**Why we need it:**

- Required for core functionality (scheduling, posting)

**Privacy implications:**

- Queue names and templates reveal content strategy
- Relay choices reveal user's Nostr network preferences

---

### 4. Payment & Subscription Data

**Stored:**

- `Payment` records (amount, invoice, payment hash, status)
- `Subscription` records (plan, status, dates)
- `encryptedNwc` - **Highly sensitive** (encrypted Nostr Wallet Connect token)

**Why we need it:**

- Required for subscription management
- `encryptedNwc`: Required for Lightning payments (if enabled)

**Privacy implications:**

- Payment data is financial information
- `encryptedNwc` is encrypted but still sensitive (if decrypted, enables payment access)

---

### 5. Analytics & Engagement Data

**Stored:**

- `PostAnalyticsDaily` - **Low sensitivity** (aggregated metrics)
- `PublishedPostRead.engagementScore` - **Low sensitivity** (public engagement data)
- `mutedList` - **Semi-sensitive** (user's block list)
- `giveawayBlackListed` - **Semi-sensitive** (user's block list)

**Why we need it:**

- Analytics: Convenience feature (users can see their stats)
- Muted lists: User preference

**Privacy implications:**

- Analytics are convenience data, not required for core functionality
- Muted lists reveal user's social graph preferences

---

### 6. System & Operational Data

**Stored:**

- `OutboxEvent` - **Sensitive** (contains job payloads with post data)
- `PostStateTransition` - **Low sensitivity** (audit trail)
- `DeadLetterJob` - **Sensitive** (contains failed job data including post content)
- `correlationId` - **Low sensitivity** (operational tracing)

**Why we need it:**

- Required for reliable job processing (outbox pattern)
- Required for debugging and audit trails

**Privacy implications:**

- Outbox events contain post data in transit
- Dead letter jobs contain failed post attempts (may include sensitive content)

---

## Threat Scenarios

### Scenario 1: Database Leak

**What an attacker learns:**

- All user npubs (public anyway)
- All draft content (highly sensitive)
- All signed events (sensitive - cryptographic signatures)
- Scheduling patterns (semi-sensitive)
- Payment records (financial data)
- Encrypted NWC tokens (if encryption is broken)

**What an attacker cannot do:**

- Sign new events (no private keys stored)
- Impersonate users (requires private key)
- Access user's Nostr wallet (NWC is encrypted)

**Mitigation:**

- Database encryption at rest
- Access controls (principle of least privilege)
- Regular security audits
- Encrypted backups

---

### Scenario 2: Log Leak

**What we log:**

- Correlation IDs
- Post IDs
- User IDs (internal)
- Error messages (may contain content snippets)
- Timing information

**What we should NOT log:**

- Full post content
- Signed events (except in error cases)
- Private keys (never logged)

**Mitigation:**

- Sanitize logs (remove sensitive content)
- Log retention policies
- Secure log storage

---

### Scenario 3: Relay Operator Correlation

**What relay operators can see:**

- When posts are published (timing)
- Post content (public on Nostr)
- User's npub (public)

**What relay operators cannot see:**

- Draft content (never sent to relays)
- Scheduling patterns (internal only)
- Failed attempts (internal only)

**Mitigation:**

- Users can choose their relays (decentralization)
- We don't reveal scheduling patterns to relays
- Failed posts never reach relays

---

### Scenario 4: Worker Process Compromise

**What an attacker can do:**

- Read post content from queue
- See scheduled posts
- Potentially republish posts (if they can access signed events)

**What an attacker cannot do:**

- Sign new events (no private keys)
- Modify signed events (signatures would break)
- Access user's wallet (NWC encrypted)

**Mitigation:**

- Worker processes run with minimal privileges
- Queue data encrypted in transit
- Signed events validated before publishing

---

### Scenario 5: Client-Side Compromise

**What an attacker can do:**

- Steal private keys (if extension is compromised)
- See draft content in browser
- Intercept signed events

**What we cannot prevent:**

- Client-side attacks are outside our control
- Users must trust their browser/extension

**Mitigation:**

- We never request private keys
- All signing happens client-side (we never see keys)
- Users can use hardware keys (NIP-07 compatible)

---

## Data Sensitivity Classification

### Highly Sensitive (Encrypt at rest, strict access)

- `signedEvent` (cryptographic signatures)
- `encryptedNwc` (wallet access)
- Draft content (unpublished thoughts)
- Payment records (financial data)

### Sensitive (Access controls, audit logging)

- Post content (before publishing)
- `OutboxEvent` payloads
- `DeadLetterJob` data
- Scheduling patterns

### Semi-Sensitive (Basic access controls)

- Timezone (approximate location)
- Queue names (content strategy)
- Templates (content patterns)
- Muted lists (social graph)

### Low Sensitivity (Public or convenience data)

- `npub` (public by design)
- Relay URLs (public)
- Published post content (public on Nostr)
- Analytics (aggregated, convenience)

---

## What We Don't Need to Know

**We explicitly do NOT need:**

- User's private keys (never stored, never requested)
- User's email address
- User's real name (unless published via Nostr)
- User's IP address (unless required for rate limiting)
- User's browsing history
- User's other Nostr activity (unless they publish it)

**We minimize:**

- Correlation data (only correlationId for operational tracing)
- Timing metadata (only what's needed for scheduling)
- Social graph data (only muted lists if user enables)

---

## Privacy Boundaries

### Boundary 1: Draft vs Published

**Draft content:**

- Never sent to Nostr relays
- Only stored in our database
- Deleted on cascade if user deletes account
- Highly sensitive

**Published content:**

- Public on Nostr network
- Stored for convenience (user can see their history)
- Less sensitive (already public)

### Boundary 2: Signed Events

**Signed events are sensitive because:**

- They contain cryptographic signatures
- They prove user's identity
- They can be replayed (if attacker gets them)

**We store them because:**

- Required for scheduled publishing
- Must be signed before scheduling (client-side)

**We protect them by:**

- Encrypting at rest
- Never logging full events
- Validating signatures before publishing

### Boundary 3: Analytics vs Core Data

**Core data (required for functionality):**

- Post content (to schedule)
- Signed events (to publish)
- Scheduled times (to schedule)

**Analytics data (convenience only):**

- Engagement scores
- Daily aggregations
- Can be disabled without breaking core functionality

---

## Compliance Considerations

### GDPR

- Users can request data export (all their posts, drafts, preferences)
- Users can request deletion (cascade delete all user data)
- We minimize data collection (only what's needed)

### Nostr Protocol

- We respect Nostr's decentralized nature
- Users control their relays
- We don't centralize user data unnecessarily

---

## Future Considerations

### If we add:

- **Team accounts**: Need to define data sharing boundaries
- **Lightning subscriptions**: Already handled (encrypted NWC)
- **Public onboarding**: Need to clarify what's public vs private
- **Enterprise users**: May need stricter data isolation

### Questions to answer:

- Should we encrypt draft content at rest? (Currently not encrypted)
- Should we allow users to delete analytics data separately?
- Should we support data export in machine-readable format?

---

## Operational Guarantees

### What we promise:

- **Drafts stay private** - Never sent to relays until published
- **Private keys never leave browser** - All signing is client-side
- **Failed posts stay internal** - Never reach Nostr network
- **Scheduling patterns are internal** - Not revealed to relays

### What we cannot promise:

- **Nostr network privacy** - Once published, content is public
- **Relay operator privacy** - Relay operators see published content
- **Client-side security** - We cannot protect against compromised browsers

---

## Security Best Practices

### For Users:

1. Use hardware keys for Nostr signing (NIP-07 compatible)
2. Choose relays you trust
3. Review scheduled posts before they publish
4. Delete drafts you don't need

### For Operators:

1. Encrypt database at rest
2. Use principle of least privilege for database access
3. Sanitize logs (remove sensitive content)
4. Regular security audits
5. Monitor for suspicious activity

---

## Revision History

- **2025-01-02**: Initial threat model document created

---

**This is a living document. Update it as the system evolves.**
