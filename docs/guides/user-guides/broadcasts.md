# Broadcasts Guide

**Estimated time:** 15 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-04-11

Learn how to send targeted signed Nostr DM broadcasts, review delivery safety checks, and manage
audiences in SmartFlowSocial.

---

## Table of Contents

- [Overview](#overview)
- [Before You Start](#before-you-start)
- [Create a Broadcast](#create-a-broadcast)
- [Audience Types](#audience-types)
- [Review and Finalize](#review-and-finalize)
- [Audiences Library](#audiences-library)
- [Suppression List](#suppression-list)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Broadcasts let you send a message to many recipients with guardrails:

- **Signed delivery** - messages are finalized with your active signer
- **Audience controls** - use mutuals or custom recipient sets
- **Pre-flight review** - verify eligibility, suppression, and compatibility before send
- **Reusable audiences** - save and reuse audience definitions

Broadcast campaigns live under **Dashboard → Broadcasts**.

---

## Before You Start

1. Connect your signing identity (NIP-07 extension or NIP-46 signer).
2. Open **Dashboard → Broadcasts → New**.
3. Confirm your plan limits for recipient volume and scheduling.

Some capabilities are plan-gated. If an option is unavailable, check your current plan in Settings.

---

## Create a Broadcast

### 1) Start a draft

On **New broadcast**, provide:

- Campaign name
- Message body
- Audience type
- Recipient lines (for custom audiences)
- Optional schedule date/time

You can:

- **Save Draft** to continue later
- **Create and continue** to review
- **Create and schedule** when schedule is available on your plan

### 2) Resolve audience

Use **Resolve audience** to compute current eligible recipients before final review. This accounts
for suppression and eligibility constraints.

---

## Audience Types

- **Mutuals** - graph-based audience of reciprocal relationships
- **Custom** - explicit recipient list you provide

When using custom audiences:

- Add valid recipient npubs/pubkeys in recipient lines
- Save commonly used sets in the audiences library

---

## Review and Finalize

The review step is your pre-flight safety checkpoint:

- Preview final message with unsubscribe footer example
- Check resolved recipient counts
- Inspect suppression and exclusion counts
- Review compatibility/lint warnings
- Confirm signer identity

When ready:

- **Sign and send now** for immediate delivery
- **Sign and schedule** for future delivery

Delivery only starts after a successful finalize/sign step.

---

## Audiences Library

Use **Broadcasts → Audiences** to:

- Save audience definitions from draft/review
- Reuse saved audiences in future campaigns
- Keep names consistent for recurring operations

Saved audiences reduce setup time and improve campaign consistency.

---

## Suppression List

Use **Broadcasts → Suppression** to prevent messaging specific recipients.

Suppression checks are applied during audience resolution and finalization. This helps avoid repeat
messages or excluded recipients.

---

## Best Practices

1. Keep broadcast copy short and clear.
2. Resolve audience right before finalizing to avoid stale recipient sets.
3. Start with a smaller audience for new campaign templates.
4. Save successful audience definitions for repeat sends.
5. Use scheduling to match recipient activity windows.

---

## Troubleshooting

### "Resolve your audience before review"

- Go back to the draft step and run **Resolve audience**
- Retry review after resolution succeeds

### "Connect your signer to finalize"

- Reconnect NIP-07 or NIP-46 signer in your session
- Confirm you are signed in with the intended identity

### Lower-than-expected recipient count

- Check suppression entries
- Check plan limits and audience type constraints
- Re-run resolution to refresh current graph-based eligibility

---

## Related Documentation

- [Engagement Guide](./engagement.md)
- [Multi-Account Guide](./multi-account.md)
- [Nostr Integration](../../reference/nostr.md)
- [API Reference](../../reference/api.md)

---

**Next:** [Contests Guide](./contests.md) → Run ranked competitions with transparent payout tracking
