# User Onboarding Guide

Welcome to SmartFlowSocial! This guide will help you get started with managing your Nostr social media presence.

## Prerequisites

Before using SmartFlowSocial, you need a **Nostr identity**. Nostr uses public/private key pairs for authentication.

### Step 1: Set Up a Nostr Wallet Extension

Install one of these browser extensions to manage your Nostr keys:

| Extension | Platform | Description |
|-----------|----------|-------------|
| [Alby](https://getalby.com/products/browser-extension) | Chrome, Firefox | Popular option with Lightning wallet built-in |
| [nos2x](https://github.com/nicefatz/nos2x) | Chrome | Lightweight Nostr signer |
| [Amber](https://nostrapps.com/amber) | Android | Mobile Nostr signer |

> **Important:** Your private key (nsec) is never shared with SmartFlowSocial. We use the NIP-07 protocol to sign events securely through your extension.

### Step 2: Connect to SmartFlowSocial

1. Open SmartFlowSocial in your browser
2. Click **"Login with Nostr"** on the homepage
3. Approve the connection request in your wallet extension
4. You'll be redirected to your dashboard

### Step 3: Configure Your Settings

Navigate to **Settings** from the dashboard to customize your experience:

#### Nostr Relays
Configure which relays to publish your content to. Default relays include:
- `wss://relay.primal.net`
- `wss://relay.damus.io`
- `wss://relay.nostr.band`
- `wss://relay.snort.social`

#### Timezone
Set your local timezone for accurate post scheduling.

#### Hashtag Presets
Create reusable hashtag collections for different types of content:
- "Bitcoin" → #bitcoin #btc #lightning
- "Art" → #nostr #art #generativeart

#### Posting Intervals
Configure available intervals for bulk scheduling (2h, 4h, 6h, 12h, 24h).

### Step 4: Create Your First Post

1. Click **"New Post"** from the dashboard
2. Enter your content
3. Optionally attach images
4. Choose to **Post Now** or **Schedule**
5. Sign the event with your Nostr extension

## Features Overview

| Feature | Description |
|---------|-------------|
| **Instant Posting** | Post immediately to Nostr |
| **Scheduled Posts** | Schedule content for future publication |
| **Bulk Upload** | Upload multiple images and schedule them automatically |
| **Giveaways** | Create and manage Nostr-native giveaways |
| **Long-form Posts** | Write and publish articles (NIP-23) |
| **Calendar View** | Visual drag-and-drop scheduling |
| **Templates** | Save reusable post templates |

## Subscription Plans

SmartFlowSocial offers multiple plan tiers:

- **Free** - Basic posting features
- **Starter** - Scheduling and basic analytics
- **Pro** - Advanced features and multiple queues
- **Lifetime** - One-time payment for permanent access

View plans at `/plans` after logging in.

## Need Help?

- Check the [Posting Workflow](./posting.md) guide
- Review the [Calendar Feature](./calendar-feature.md) documentation
- Open an issue on GitHub for bugs or questions
