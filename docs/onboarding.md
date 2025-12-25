# User Onboarding Guide

Welcome to SmartFlowSocial! This comprehensive guide will help you get started with managing your Nostr social media presence.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup](#step-by-step-setup)
- [Initial Configuration](#initial-configuration)
- [Creating Your First Post](#creating-your-first-post)
- [Understanding Features](#understanding-features)
- [Subscription Plans](#subscription-plans)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

---

## Overview

SmartFlowSocial is a professional-grade social media management platform for Nostr. It enables you to:

- **Schedule Posts**: Plan your content in advance
- **Manage Multiple Accounts**: Handle parent/child account relationships
- **Track Engagement**: Monitor replies, mentions, and interactions
- **Bulk Operations**: Upload and schedule multiple posts at once
- **Long-form Content**: Publish full articles (NIP-23)
- **Visual Calendar**: Drag-and-drop scheduling interface

---

## Prerequisites

Before using SmartFlowSocial, you need:

1. **Nostr Identity**: A Nostr public/private key pair
2. **Nostr Browser Extension**: For authentication and signing events
3. **Lightning Wallet** (Optional): For paid subscriptions

### Understanding Nostr

Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized social protocol. Key concepts:

- **Public Key (npub)**: Your public identifier (like a username)
- **Private Key (nsec)**: Your secret key (never share this!)
- **Relays**: Servers that store and forward your messages
- **Events**: Signed messages you publish to relays

> **Important:** Your private key (nsec) is **never** shared with SmartFlowSocial. We use the NIP-07 protocol to sign events securely through your browser extension.

---

## Step-by-Step Setup

### Step 1: Install a Nostr Browser Extension

Choose and install one of these extensions:

| Extension | Platform | Description | Best For |
|---------|----------|------------|----------|
| [Alby](https://getalby.com/products/browser-extension) | Chrome, Firefox | Popular option with Lightning wallet built-in | Users who want Lightning integration |
| [nos2x](https://github.com/nicefatz/nos2x) | Chrome | Lightweight Nostr signer | Simple, focused use |
| [Amber](https://nostrapps.com/amber) | Android | Mobile Nostr signer | Mobile users |
| [GetAlby](https://getalby.com) | All platforms | Full-featured wallet | Advanced users |

**Installation Steps:**

1. Visit the extension's website
2. Click "Install" or "Add to Browser"
3. Follow the installation prompts
4. Create a new key pair or import existing keys
5. **Backup your keys** - Write down your recovery phrase or nsec

> ⚠️ **Security Warning**: Never share your private key (nsec) with anyone. SmartFlowSocial never sees or stores your private key.

### Step 2: Connect to SmartFlowSocial

1. **Open SmartFlowSocial** in your browser
   - Visit your SmartFlowSocial instance URL
   - Or use the hosted version

2. **Click "Login with Nostr"** on the homepage
   - You'll see a login button or prompt

3. **Approve the Connection Request**
   - Your Nostr extension will prompt you
   - Review the permissions requested
   - Click "Approve" or "Connect"

4. **Sign the Authentication Challenge**
   - The extension will ask you to sign a challenge event
   - This proves you own the private key
   - Click "Sign" in your extension

5. **You'll be Redirected to Dashboard**
   - First-time users see the onboarding flow
   - Returning users go directly to dashboard

**What Happens Behind the Scenes:**

- SmartFlowSocial requests your public key via `window.nostr.getPublicKey()`
- You sign an authentication challenge event
- The server verifies your signature
- A session is created and stored in a secure cookie
- You're authenticated and can use the platform

### Step 3: Complete Your Profile

After logging in, you may be prompted to complete your profile:

1. **Verify Your Public Key**
   - Your npub is displayed
   - Verify it matches your extension

2. **Set Your Timezone**
   - Important for accurate scheduling
   - Select your local timezone from the dropdown

3. **Configure Initial Settings** (Optional)
   - You can configure these later in Settings
   - Click "Skip" to proceed to dashboard

---

## Initial Configuration

Navigate to **Settings** (gear icon in header) to configure your experience.

### Nostr Relays

Relays are servers that store and forward your Nostr events. Configure which relays to publish to:

**Default Relays:**
- `wss://relay.primal.net`
- `wss://relay.damus.io`
- `wss://relay.nostr.band`
- `wss://relay.snort.social`

**How to Configure:**

1. Go to **Settings → Relays**
2. Add relay URLs (one per line)
3. Click "Save"
4. Your posts will be published to all configured relays

**Relay Selection Tips:**

- **Use Multiple Relays**: Redundancy ensures your posts are available
- **Choose Reliable Relays**: Check relay uptime and reputation
- **Consider Geographic Location**: Use relays close to your audience
- **Test Relays**: Some relays may be slow or unreliable

**Relay URL Format:**
```
wss://relay.example.com
wss://relay.example.com:443
```

### Timezone Configuration

Set your local timezone for accurate post scheduling:

1. Go to **Settings → General**
2. Select your timezone from the dropdown
3. Click "Save"

**Why Timezone Matters:**

- Scheduled posts use your timezone
- Calendar view displays times in your timezone
- Queue scheduling respects your timezone

### Hashtag Presets

Create reusable hashtag collections for different content types:

**Example Presets:**

- **Bitcoin**: `#bitcoin #btc #lightning #nostr`
- **Art**: `#nostr #art #generativeart #digitalart`
- **Tech**: `#nostr #tech #bitcoin #lightning`
- **Personal**: `#nostr #life #thoughts`

**How to Create:**

1. Go to **Settings → Hashtags**
2. Click "New Preset"
3. Enter a name (e.g., "Bitcoin")
4. Enter hashtags (space or comma separated)
5. Add description (optional)
6. Click "Save"

**Using Presets:**

- Select a preset when creating posts
- Presets can be assigned to queues
- Presets can be combined with manual hashtags

### Posting Intervals

Configure available intervals for bulk scheduling:

**Default Intervals:**
- 2 hours
- 4 hours
- 6 hours
- 12 hours
- 24 hours

**How to Configure:**

1. Go to **Settings → General**
2. Select intervals from the list
3. Click "Save"

**Custom Intervals:**

You can add custom intervals by editing the settings. Intervals are specified in hours.

### Upload Provider

Choose where to store your uploaded images:

**Options:**

- **S3-Compatible Storage**: AWS S3, Cloudflare R2, MinIO
- **Blossom Primal**: Primal's Blossom service
- **Blossom Blosstr**: Blosstr's Blossom service

**Configuration:**

1. Go to **Settings → Storage**
2. Select your provider
3. Configure provider-specific settings
4. Test upload to verify

See [Environment Setup](./environment-setup.md) for detailed storage configuration.

---

## Creating Your First Post

### Quick Start: Instant Post

1. **Click "New Post"** from the dashboard
   - Located in the header or main navigation

2. **Select Post Type**
   - **Text**: Plain text post
   - **Image**: Single image with caption
   - **Carousel**: Multiple images
   - **Video**: Video URL embedded

3. **Enter Your Content**
   - Type your post text
   - Add hashtags manually or select a preset
   - Attach images if needed

4. **Click "Post Now"**
   - Review your post in the preview
   - Click "Post Now" to confirm

5. **Sign the Event**
   - Your Nostr extension will prompt you
   - Review the event details
   - Click "Sign" to approve

6. **Post Published!**
   - Your post is immediately published to Nostr
   - You'll see a success message
   - The post appears in your "Posted" section

### Scheduled Post

To schedule a post for later:

1. **Create Your Post** (steps 1-3 above)

2. **Toggle "Schedule for later"**
   - Switch appears below the content area

3. **Select Date and Time**
   - Use the date/time picker
   - Times are in your configured timezone

4. **Optional: Assign to Queue**
   - Select a queue type if you have multiple queues
   - Queues help organize content

5. **Click "Schedule Post"**
   - Review the scheduled time
   - Click "Schedule Post" to confirm

6. **Sign the Event**
   - Sign with your Nostr extension
   - The event is signed with the scheduled timestamp

7. **Post Scheduled!**
   - Post appears in "Scheduled" section
   - Will automatically publish at scheduled time
   - You can edit or reschedule before publishing

---

## Understanding Features

### Feature Access by Plan

| Feature | Free | Basic+ |
|---------|------|--------|
| **Instant Posting** | ✅ | ✅ |
| **Basic Scheduling** | ✅ | ✅ |
| **Drafts** | ❌ | ✅ |
| **Calendar View** | ❌ | ✅ |
| **Bulk Upload** | ❌ | ✅ |
| **Long-form Posts** | ❌ | ✅ |
| **Templates** | ❌ | ✅ |
| **Recyclables** | ❌ | ✅ |
| **Engagement Feed** | ❌ | ✅ |
| **Multiple Queues** | ❌ | ✅ |

### Core Features Explained

#### Instant Posting
Post immediately to Nostr with one click. Perfect for time-sensitive content.

#### Scheduled Posts
Plan your content in advance. Posts are automatically published at the scheduled time.

#### Bulk Upload
Upload multiple images and schedule them automatically with intervals. Great for content creators.

#### Calendar View
Visual drag-and-drop interface for managing scheduled posts. See your content schedule at a glance.

#### Long-form Posts
Publish full articles (NIP-23) with rich text formatting, images, and proper article structure.

#### Templates
Save reusable post templates with placeholders. Speed up content creation.

#### Recyclables
Mark posts as recyclable to reuse evergreen content. Reschedule for future dates.

#### Engagement Feed
Track replies, mentions, and interactions. Monitor your Nostr engagement.

#### Multiple Queues
Organize content with different scheduling rules. Create queues for different topics or campaigns.

---

## Subscription Plans

SmartFlowSocial offers multiple plan tiers to suit different needs.

### Plan Comparison

| Feature | Free | Basic | Premium | Pro | Enterprise |
|---------|------|-------|---------|-----|------------|
| **Price** | Free | $X/mo | $X/mo | $X/mo | Custom |
| **Instant Posting** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Basic Scheduling** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Drafts** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Calendar View** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Bulk Upload** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Long-form Posts** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Templates** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Recyclables** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Engagement Feed** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Multiple Queues** | ❌ | Limited | ✅ | ✅ | ✅ |
| **Analytics** | ❌ | Basic | Advanced | Advanced | Custom |
| **Support** | Community | Email | Priority | Priority | Dedicated |

### Upgrading Your Plan

1. **Navigate to Plans**
   - Click "Plans" in the header
   - Or go to `/plans`

2. **Compare Plans**
   - Review features for each plan
   - See what's included

3. **Select a Plan**
   - Click "Choose Plan" on your desired tier
   - Review the pricing

4. **Complete Payment**
   - Lightning invoice is generated
   - Pay with your Lightning wallet
   - Account is activated automatically

5. **Access New Features**
   - Features unlock immediately after payment
   - No restart or refresh needed

See [Lightning Payments Guide](./LIGHTNING_PAYMENTS.md) for detailed payment information.

---

## Troubleshooting

### Login Issues

**Problem: Extension Not Found**

**Symptoms:**
- "Nostr extension not found" error
- Login button does nothing

**Solutions:**
1. Verify extension is installed and enabled
2. Refresh the page
3. Check extension permissions
4. Try a different browser
5. Restart your browser

**Problem: Signing Failed**

**Symptoms:**
- Extension prompts but signing fails
- "Failed to sign event" error

**Solutions:**
1. Check extension is unlocked
2. Verify extension permissions
3. Try signing again
4. Check browser console for errors
5. Try a different extension

**Problem: Session Expires Quickly**

**Symptoms:**
- Logged out frequently
- Need to re-authenticate often

**Solutions:**
1. Check browser cookie settings
2. Clear cookies and try again
3. Disable cookie-blocking extensions
4. Check if using incognito/private mode

### Configuration Issues

**Problem: Relays Not Working**

**Symptoms:**
- Posts not appearing on Nostr
- Publishing errors

**Solutions:**
1. Verify relay URLs are correct (must start with `wss://`)
2. Test relay connectivity
3. Try different relays
4. Check relay status/uptime
5. Use multiple relays for redundancy

**Problem: Timezone Wrong**

**Symptoms:**
- Scheduled posts at wrong time
- Calendar shows incorrect times

**Solutions:**
1. Check timezone setting in Settings
2. Verify system timezone
3. Clear browser cache
4. Re-select timezone

### Post Creation Issues

**Problem: Can't Upload Images**

**Symptoms:**
- Upload fails
- Images don't appear

**Solutions:**
1. Check storage provider configuration
2. Verify file size limits
3. Check file format (JPG, PNG, WebP supported)
4. Check browser console for errors
5. Verify storage credentials

**Problem: Posts Not Scheduling**

**Symptoms:**
- Scheduled posts don't publish
- Posts stuck in "Scheduled"

**Solutions:**
1. Check worker process is running
2. Verify Redis connection
3. Check post has signed event
4. Verify scheduled time is in future
5. Check queue configuration

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for more detailed solutions.

---

## Next Steps

Now that you're set up, explore these features:

1. **Create Your First Scheduled Post**
   - Try scheduling a post for tomorrow
   - See how it appears in the calendar

2. **Set Up Hashtag Presets**
   - Create presets for your content types
   - Use them when creating posts

3. **Explore the Calendar View** (if on paid plan)
   - Drag and drop posts to reschedule
   - See your content schedule visually

4. **Try Bulk Upload** (if on paid plan)
   - Upload multiple images
   - Schedule them automatically

5. **Read Feature Guides**
   - [Posting Workflow](./posting.md) - Detailed posting guide
   - [Calendar Feature](./calendar-feature.md) - Calendar documentation
   - [Lightning Payments](./LIGHTNING_PAYMENTS.md) - Payment system

---

## Additional Resources

- [Posting Workflow Guide](./posting.md) - How to create and manage posts
- [Calendar Feature Guide](./calendar-feature.md) - Visual scheduling
- [Nostr Integration Guide](./NOSTR_INTEGRATION.md) - Nostr protocol details
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [API Reference](./api-reference.md) - API endpoints

---

## Getting Help

If you need assistance:

1. **Check Documentation**: Review relevant guides
2. **Search Issues**: Check GitHub issues for similar problems
3. **Community Support**: Join the community discussions
4. **Report Bugs**: Open an issue on GitHub with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and extension information
   - Error messages (if any)

---

Welcome to SmartFlowSocial! We're here to help you manage your Nostr presence effectively. 🚀
