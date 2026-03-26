# Giveaways Guide

**Estimated time:** 20 minutes  
**Difficulty:** Beginner  
**Last updated:** 2025-03-12

Complete guide to creating and managing Nostr giveaways with fair winner selection in
SmartFlowSocial.

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Creating Giveaways](#creating-giveaways)
- [Selecting Winners](#selecting-winners)
- [Managing Giveaways](#managing-giveaways)
- [Giveaway Filters](#giveaway-filters)
- [Blacklist Management](#blacklist-management)
- [Posting Results](#posting-results)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial's giveaway feature allows you to:

- **Track engagement** on your posts (likes, reposts, comments, zaps)
- **Select random winners** fairly from participants
- **Filter participants** by engagement type
- **Manage blacklists** to exclude specific accounts
- **Post results** automatically with winner announcements

### How It Works

1. **Post content** to Nostr (memes, announcements, etc.)
2. **Track engagement** (likes, reposts, comments, zaps)
3. **Select winners** randomly from participants
4. **Post results** announcing winners

---

## Getting Started

### Prerequisites

- **Active subscription** (Free plan has access to giveaways)
- **Posted content** with engagement
- **Nostr extension** for signing results

### Accessing Giveaways

1. Click **"Giveaways"** in the navigation
2. View your posts with engagement
3. Select a post to create a giveaway

---

## Creating Giveaways

### Giveaway Workflow

```mermaid
flowchart TD
    Start[Create Giveaway Post] --> Config[Configure Giveaway]
    Config --> Filters{Set Filters?}
    Filters -->|Yes| SetFilters[Set Engagement Filters]
    Filters -->|No| Publish
    SetFilters --> Blacklist{Use Blacklist?}
    Blacklist -->|Yes| AddBlacklist[Add Excluded Users]
    Blacklist -->|No| Publish
    AddBlacklist --> Publish[Publish Giveaway]
    Publish --> Monitor[Monitor Engagement]
    Monitor --> EndDate{End Date Reached?}
    EndDate -->|No| Monitor
    EndDate -->|Yes| Select[Select Random Winner]
    Select --> Verify{Verify Winner?}
    Verify -->|Invalid| Select
    Verify -->|Valid| Announce[Announce Winner]
    Announce --> Complete[Giveaway Complete]
```

### Step 1: View Posts with Engagement

1. Go to **Giveaways** page
2. See all your posted content with engagement
3. Posts are sorted by total engagement
4. Filter by queue type or time period

### Step 2: Select a Post

1. Click on a post with engagement
2. View engagement statistics:
   - **Likes** - Number of likes
   - **Reposts** - Number of reposts
   - **Comments** - Number of replies
   - **Zaps** - Number of zaps and total sats

### Step 3: Configure Giveaway

1. **Set time period:**
   - Last 7 days (default)
   - Last 14 days
   - Last 30 days
   - Custom range

2. **Filter by queue:**
   - All queues
   - Specific queue type

3. **View participants:**
   - See all users who engaged
   - Filter by engagement type

---

## Selecting Winners

### Random Winner Selection

SmartFlowSocial uses a fair random selection process:

1. **Group participants** by engagement type:
   - Reposters (kind 6)
   - Likers (kind 7, 9735, 9734)
   - Commenters (kind 1)

2. **Select random winners:**
   - 3 random reposters
   - 3 random likers
   - 3 random commenters

3. **Display winners:**
   - See selected winners
   - View their profiles
   - Copy winner list

### Winner Selection Process

**How it works:**

- Random selection from each category
- No bias or favoritism
- Transparent process
- Verifiable results

**Example:**

```
✅ 3 random reposts from last week each got 2,000 sats
✅ 3 random reactions from last week each got 1,000 sats
✅ 3 random comments from last week each got 1,000 sats
```

---

## Managing Giveaways

### Giveaway Dashboard

**Features:**

- View all posts with engagement
- Filter by queue type
- Filter by time period
- See engagement statistics
- Access giveaway tools

### Payout terminology (v2)

When winners are locked, Giveaways and Contests use shared payout language:

- **Pay winners now** - start wallet payout from your connected NWC wallet
- **Payout method** - choose manual payout or wallet payout
- **Auto-pay after lock** - automatically start wallet payout after lock
- **Auto-pay cap** - maximum sats auto-pay can spend in one run
- **Mark paid manually** - confirm off-app/manual payment
- **Finish campaign** - close payout tracking and generate final receipt/proof

Support notes shown in the UI:

- **SmartFlowSocial never holds prize funds**
- **Winners are fixed after lock**
- **Manual payout remains available as fallback**

### Engagement Statistics

**Metrics shown:**

- Total engagement count
- Likes, reposts, comments, zaps
- Total sats zapped
- Participant count

### Queue Filtering

**Filter options:**

- **All Queues** - All posts
- **Specific Queue** - Posts from one queue
- **Unassigned** - Posts without queue

---

## Giveaway presets and complex giveaways

### Giveaway presets

You can save a giveaway configuration as a **preset** and reuse it for future giveaways. Presets
store scope (e.g. last 7 days, single post, queue), engagement types (reactions, reposts, comments,
zaps), winner count, selection mode, and optional filters.

**How to use presets:**

1. When creating a giveaway, configure scope, engagement types, winner count, and filters as
   desired.
2. Save as a preset (if the option is available): give it a name (e.g. "Weekly repost giveaway").
3. Next time, choose that preset to pre-fill the same configuration; adjust only what you need (e.g.
   time range or post).

**Use cases:**

- Run the same style of giveaway every week with one click.
- Keep multiple presets for different campaigns (repost-only vs. comment-only vs. mixed).

### Multiple winner pools and engagement config

**Complex giveaways** let you define **per-engagement-type** winner counts and sats per winner
instead of a single global winner count. For example:

- 3 winners from **reposts**, 2,000 sats each
- 3 winners from **reactions**, 1,000 sats each
- 2 winners from **comments**, 1,500 sats each

**How to configure:**

1. When creating or editing a giveaway, look for **Engagement config** or **Per-type winners**
   (wording may vary).
2. For each engagement type (Reaction, Repost, Comment, Zap), set:
   - **Winner count** – how many winners from that type
   - **Sats per winner** (optional) – amount each winner receives
3. The total winner count is the sum across types. Lock the giveaway when ready; the system selects
   random winners from each pool and can include them in the winner announcement.

**Selection mode:**

- **Unique user** – each winner is a distinct account (no duplicate winners across pools if the same
  user qualified in multiple types; implementation may vary).
- **Weighted by engagement** – optional weights per engagement type so that some actions (e.g.
  repost) count more than others when drawing winners. Use this for "reposts get 2x entries" style
  giveaways.

**Filters:**

- Exclude muted or blacklisted accounts, minimum account age, minimum followers, etc., so only
  eligible participants are included. Configure under giveaway filters or blacklist settings.

---

## Giveaway Filters

### Filter by Engagement Type

**Available filters:**

- **All** - All engagement types
- **Reposts** - Only reposters
- **Likes** - Only likers
- **Comments** - Only commenters
- **Zaps** - Only zappers

### Filter by Time Period

**Time options:**

- **Last 7 days** (default)
- **Last 14 days**
- **Last 30 days**
- **Custom range**

### Filter by Queue

**Queue options:**

- **All queues**
- **Specific queue type**
- **Unassigned posts**

---

## Blacklist Management

### What is a Blacklist?

A blacklist allows you to exclude specific accounts from giveaway participation.

### Managing Blacklist

1. Go to **Settings** → **Giveaways** → **Blacklist**
2. **Add accounts:**
   - Enter npub or hex pubkey
   - Click "Add to Blacklist"
   - Account is excluded from giveaways

3. **Remove accounts:**
   - View blacklisted accounts
   - Click "Remove"
   - Account can participate again

### Use Cases

**When to use blacklist:**

- Exclude bots
- Exclude spam accounts
- Exclude specific users
- Maintain giveaway integrity

---

## Posting Results

### Generate Giveaway Post

1. **Select winners** using randomizer
2. **Click "Generate Message"**
3. **Review generated post:**

   ```
   Thanks to everyone who shared, zapped, liked and commented on our memes lately 🫡

   ✅ 3 random reposts from last week each got 2,000 sats - congrats to @npub1... 🎉

   ✅ 3 random reactions from last week each got 1,000 sats - congrats to @npub2... 🎉

   ✅ 3 random comments from last week each got 1,000 sats - congrats to @npub3... 🎉

   Enjoy your memes and have a nice day!

   #bitcoin #plebchain #giveaway
   ```

4. **Edit if needed:**
   - Customize message
   - Add additional content
   - Modify hashtags

5. **Copy to clipboard:**
   - Click "Copy"
   - Paste into new post
   - Schedule or post immediately

### Posting Workflow

**Option 1: Post Immediately**

1. Generate message
2. Copy to clipboard
3. Go to **New Post**
4. Paste and post

**Option 2: Schedule Post**

1. Generate message
2. Copy to clipboard
3. Go to **New Post**
4. Paste and schedule

---

## Best Practices

### Giveaway Strategy

1. **Set clear rules:**
   - Define engagement types
   - Set time period
   - Specify prizes

2. **Announce in advance:**
   - Post giveaway announcement
   - Include rules and timeline
   - Build anticipation

3. **Track engagement:**
   - Monitor participation
   - Check engagement metrics
   - Adjust strategy as needed

4. **Select winners fairly:**
   - Use random selection
   - Be transparent
   - Post results publicly

5. **Post results promptly:**
   - Announce winners quickly
   - Include prize details
   - Thank all participants

### Engagement Types

**Reposts (Kind 6):**

- Sharing your content
- Amplifying your message
- Higher engagement value

**Likes (Kind 7, 9735, 9734):**

- Positive feedback
- Quick engagement
- Easy participation

**Comments (Kind 1):**

- Thoughtful engagement
- Conversation starters
- Community building

**Zaps (Kind 9735):**

- Monetary support
- Highest engagement value
- Lightning payments

### Prize Distribution

**Common patterns:**

- **Equal prizes** - Same amount for all winners
- **Tiered prizes** - Different amounts by category
- **Weighted selection** - More winners from higher engagement

**Example:**

- Reposters: 2,000 sats each
- Likers: 1,000 sats each
- Commenters: 1,000 sats each

---

## Troubleshooting

### No Engagement Shown

**Possible causes:**

- Post hasn't received engagement yet
- Time period too short
- Filters too restrictive

**Solutions:**

- Check post on Nostr directly
- Expand time period
- Remove filters
- Verify post was published

### Winners Not Showing

**Possible causes:**

- No participants in category
- Blacklist filtering all participants
- Engagement type filter too restrictive

**Solutions:**

- Check engagement statistics
- Review blacklist
- Adjust filters
- Verify engagement types

### Generated Message Issues

**Possible causes:**

- Missing winner data
- Formatting issues
- npub encoding problems

**Solutions:**

- Regenerate message
- Check winner selection
- Verify npub format
- Try again

---

## Related Documentation

- [Posting Guide](./posting.md) - Create and schedule posts
- [Engagement Guide](./engagement.md) - Track interactions
- [Settings Guide](./settings.md) - Configure giveaways
- [Payments Guide](./payments.md) - Subscription requirements

---

**Next:** [Multi-Account Guide](./multi-account.md) → Manage multiple accounts
