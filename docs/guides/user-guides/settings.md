# Settings Guide

**Estimated time:** 30 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Complete guide to configuring all settings in SmartFlowSocial, from timezone to storage to engagement filters.

---

## Table of Contents

- [Overview](#overview)
- [General Settings](#general-settings)
- [Queue Types](#queue-types)
- [Hashtag Presets](#hashtag-presets)
- [Storage Settings](#storage-settings)
- [Engagement Settings](#engagement-settings)
- [Subscription Settings](#subscription-settings)
- [Account Settings](#account-settings)
- [NWC Settings](#nwc-settings)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial settings are organized into tabs:

1. **General** - Timezone, relays, hashtag display
2. **Queues** - Queue type management
3. **Hashtags** - Hashtag preset management
4. **Storage** - Upload provider and Blossom settings
5. **Engagement** - Muted lists and trust scores
6. **Subscription** - Plan management and payment history
7. **Accounts** - Parent/child account management
8. **NWC** - Nostr Wallet Connect settings

### Accessing Settings

1. Click **"Settings"** in navigation
2. Select a tab to configure
3. Make changes
4. Click **"Save"** to apply

---

## General Settings

### Timezone

**Purpose:** Set your timezone for scheduling posts.

**How to configure:**

1. Go to **Settings** → **General**
2. Select your timezone from dropdown
3. Click **"Save"**

**Impact:**

- Scheduled posts use your timezone
- Calendar view displays in your timezone
- Queue scheduling respects timezone

**Example:**

- Timezone: `America/New_York`
- Post scheduled for 9:00 AM → 9:00 AM EST/EDT

### Relays

**Purpose:** Configure Nostr relays for publishing.

**How to configure:**

1. Go to **Settings** → **General**
2. Add relay URLs (one per line):
   ```
   wss://relay.example.com
   wss://relay2.example.com
   ```
3. Click **"Save"**

**Impact:**

- Posts published to configured relays
- Relays used for event distribution
- Multiple relays for redundancy

**Best practices:**

- Use multiple relays
- Choose reliable relays
- Include public relays

### Show Hashtags in Posts

**Purpose:** Automatically append hashtags to posts.

**How to configure:**

1. Go to **Settings** → **General**
2. Toggle **"Show Hashtags in Posts"**
3. Click **"Save"**

**Impact:**

- Hashtags automatically added to posts
- Uses queue default or selected preset
- Can be overridden per post

---

## Queue Types

### Creating Queue Types

1. Go to **Settings** → **Queues**
2. Click **"Create Queue"**
3. Configure:

   - **Name** - Queue identifier
   - **Color** - Visual identifier
   - **Description** - Queue purpose
   - **Schedule Type** - Interval or Fixed Slots
   - **Schedule Config** - Timing details
   - **Default Hashtag Preset** - Auto-applied preset

4. Click **"Save"**

### Editing Queue Types

1. Go to **Settings** → **Queues**
2. Find queue in list
3. Click **"Edit"**
4. Modify settings
5. Click **"Save"**

### Deleting Queue Types

1. Go to **Settings** → **Queues**
2. Find queue in list
3. Click **"Delete"**
4. Confirm deletion

**Note:** Posts assigned to deleted queue become "unassigned"

---

## Hashtag Presets

### Creating Hashtag Presets

1. Go to **Settings** → **Hashtags**
2. Click **"Create Preset"**
3. Enter:

   - **Name** - Preset identifier
   - **Tags** - Hashtags (space or comma separated)
   - **Description** - Preset purpose

4. Click **"Save"**

**Example:**

```
Name: Bitcoin Content
Tags: #bitcoin #lightning #nostr #plebchain
Description: For Bitcoin-related content
```

### Assigning to Queues

1. Go to **Settings** → **Queues**
2. Edit a queue
3. Select **"Default Hashtag Preset"**
4. Choose preset from dropdown
5. Click **"Save"**

**Impact:**

- Preset automatically applied to posts in queue
- Can be overridden per post
- Saves time on repetitive hashtags

### Managing Presets

**Edit preset:**

1. Find preset in list
2. Click **"Edit"**
3. Modify tags or description
4. Click **"Save"**

**Delete preset:**

1. Find preset in list
2. Click **"Delete"**
3. Confirm deletion

**Note:** Presets assigned to queues remain until queue is updated

---

## Storage Settings

### Upload Provider

**Purpose:** Choose where images are uploaded.

**Options:**

- **S3** - AWS S3 or compatible
- **Blossom** - Blossom protocol storage

**How to configure:**

1. Go to **Settings** → **Storage**
2. Select **"Upload Provider"**
3. Choose S3 or Blossom
4. Click **"Save"**

**Impact:**

- All new uploads use selected provider
- Existing uploads unchanged
- Provider-specific features available

### Blossom Storage

**Purpose:** Configure Blossom protocol storage.

**Settings:**

- **Enable Mirror Blossom** - Mirror uploads to Blossom
- **Mirror Upload URLs** - Blossom server URLs

**How to configure:**

1. Go to **Settings** → **Storage**
2. Toggle **"Enable Mirror Blossom"**
3. Add Blossom server URLs (one per line)
4. Click **"Save"**

**Use cases:**

- Decentralized storage
- Censorship resistance
- Multiple storage locations

---

## Engagement Settings

### Muted Lists

**Purpose:** Filter out specific accounts or keywords from engagement feed.

**How to configure:**

1. Go to **Settings** → **Engagement**
2. **Muted Accounts:**

   - Add npub addresses
   - One per line
   - Click **"Save"**

3. **Muted Keywords:**
   - Add keywords
   - One per line
   - Click **"Save"**

**Impact:**

- Muted accounts hidden from engagement feed
- Posts with muted keywords filtered
- Giveaway participants filtered

### Trust Score Filtering

**Purpose:** Hide posts from low-trust users.

**How to configure:**

1. Go to **Settings** → **Engagement**
2. Toggle **"Hide Posts from Low Trust Users"**
3. Click **"Save"**

**Impact:**

- Low-trust users filtered from engagement
- Reduces spam and bot interactions
- Improves feed quality

### Filter Muted

**Purpose:** Automatically filter muted accounts.

**How to configure:**

1. Go to **Settings** → **Engagement**
2. Toggle **"Filter Muted"**
3. Click **"Save"**

**Impact:**

- Muted accounts automatically filtered
- Applies to engagement feed
- Applies to giveaways

---

## Subscription Settings

### View Current Plan

1. Go to **Settings** → **Subscription**
2. View **"Current Plan"** section:
   - Plan name
   - Status (Active, Cancelled, etc.)
   - Price and billing period
   - Next payment date

### Upgrade Plan

1. Go to **Settings** → **Subscription**
2. Click **"Upgrade"** or **"Change Plan"**
3. Select new plan
4. Complete payment
5. Plan activated

### Cancel Subscription

1. Go to **Settings** → **Subscription**
2. Click **"Cancel Subscription"**
3. Confirm cancellation
4. Subscription remains active until period end

### Payment History

1. Go to **Settings** → **Subscription**
2. Click **"Payment History"** tab
3. View all payments:
   - Date
   - Amount
   - Payment method
   - Status

---

## Account Settings

### Parent/Child Accounts

**For Parent Accounts:**

- Search for child accounts
- Request child links
- Manage child accounts
- Unlink child accounts

**For Child Accounts:**

- View parent account
- Accept/reject parent requests
- Unlink from parent

See [Multi-Account Guide](./multi-account.md) for details.

---

## NWC Settings

### Nostr Wallet Connect

**Purpose:** Configure NWC for Lightning payments.

**Settings:**

- **NWC Enabled** - Enable/disable NWC
- **NWC String** - Connection string (masked)
- **Last Used** - Last usage timestamp

**How to configure:**

1. Go to **Settings** → **NWC**
2. Enter NWC connection string
3. Click **"Save"**

**Format:**

```
nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=...
```

**Use cases:**

- Receiving subscription payments
- Lightning payments
- Wallet integration

---

## Best Practices

### Settings Organization

1. **Configure timezone first:**

   - Ensures correct scheduling
   - Affects all time-based features

2. **Set up queues:**

   - Create queues before posting
   - Assign hashtag presets
   - Configure scheduling rules

3. **Create hashtag presets:**

   - Organize by content type
   - Assign to queues
   - Reuse across posts

4. **Configure storage:**

   - Choose provider
   - Set up Blossom if needed
   - Test uploads

5. **Set engagement filters:**
   - Add muted accounts
   - Configure trust filtering
   - Improve feed quality

### Settings Maintenance

1. **Review regularly:**

   - Check settings quarterly
   - Update as needed
   - Remove unused presets

2. **Organize queues:**

   - Clear naming
   - Logical grouping
   - Remove unused queues

3. **Manage presets:**
   - Keep presets current
   - Remove duplicates
   - Update tags

---

## Troubleshooting

### Settings Not Saving

**Possible causes:**

- Form validation errors
- Network issues
- Permission problems

**Solutions:**

- Check for error messages
- Verify form fields
- Try again
- Check browser console

### Settings Not Applying

**Possible causes:**

- Cache issues
- Settings not saved
- Feature not enabled

**Solutions:**

- Refresh page
- Verify settings saved
- Check feature access
- Clear browser cache

---

## Related Documentation

- [Multi-Account Guide](./multi-account.md) - Account management
- [Payments Guide](./payments.md) - Subscription details
- [Posting Guide](./posting.md) - How settings affect posting
- [Configuration Reference](../reference/configuration.md) - Technical details

---

**Next:** [Search Guide](./search.md) → Search for Nostr events
