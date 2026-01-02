# Search Guide

**Estimated time:** 15 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Complete guide to searching for Nostr events, viewing engagement statistics, and scheduling quote posts or reposts.

---

## Table of Contents

- [Overview](#overview)
- [Searching for Events](#searching-for-events)
- [Viewing Search Results](#viewing-search-results)
- [Engagement Statistics](#engagement-statistics)
- [Scheduling from Search](#scheduling-from-search)
- [Best Practices](#best-practices)

---

## Overview

SmartFlowSocial's search feature allows you to:

- **Search for Nostr events** by event ID or nevent1
- **View event details** including content, author, and media
- **See engagement statistics** (likes, replies, reposts, zaps)
- **Schedule quote posts** from search results
- **Schedule reposts** (Kind 6) from search results

### Use Cases

- **Content discovery** - Find interesting posts to share
- **Engagement analysis** - Check how posts perform
- **Content curation** - Find posts to quote or repost
- **Event verification** - Verify event IDs and content

---

## Searching for Events

### Supported Formats

**Event ID:**

- 64-character hex string
- Example: `abc123...def456`

**nevent1:**

- Nostr event identifier (NIP-19)
- Example: `nevent1abc123...`

### How to Search

1. Go to **Search** page
2. Enter event ID or nevent1 in search box
3. Click **"Search"** or press Enter
4. Results appear below

### Search Process

**What happens:**

1. Event ID is decoded (if nevent1)
2. Event fetched from Primal cache
3. Author profile information loaded
4. Engagement statistics retrieved
5. Media URLs extracted from content

**If event not found:**

- Error message displayed
- Check event ID format
- Verify event exists on Nostr

---

## Viewing Search Results

### Event Information

**Author Details:**

- Profile picture
- Author name
- Event creation date
- Event kind (type)

**Event Content:**

- Full text content
- Formatted display
- Preserves line breaks

**Media Preview:**

- Extracted images/videos
- Grid layout (up to 6 visible)
- Shows count if more than 6
- Click to view full size

**Event ID:**

- Full event ID displayed
- Copyable code block
- Used for verification

### Event Metadata

**Displayed information:**

- **Created at** - When event was created
- **Kind** - Event type (1 = note, 6 = repost, etc.)
- **Author** - Event creator
- **Content** - Event text content
- **Tags** - Event tags (if any)

---

## Engagement Statistics

### Statistics Displayed

**Likes:**

- Number of likes (kind 7, 9735, 9734)
- Positive engagement indicator

**Replies:**

- Number of replies (kind 1)
- Conversation engagement

**Reposts:**

- Number of reposts (kind 6)
- Sharing engagement

**Zaps:**

- Number of zaps (kind 9735)
- Lightning payments received

**Mentions:**

- Number of mentions
- References to event

**Sats Zapped:**

- Total sats received
- Lightning payment total

### Statistics Grid

**Layout:**

- 3 columns on mobile
- 6 columns on desktop
- Large numbers for visibility
- Labels below numbers

**Use cases:**

- **Content analysis** - See what performs well
- **Engagement comparison** - Compare different posts
- **Trend identification** - Find popular content

---

## Scheduling from Search

### Schedule Quote Post

**What it does:**

- Creates a quote post (kind 1 with quote tag)
- Includes original event reference
- Allows you to add commentary

**How to use:**

1. Search for event
2. View search results
3. Click **"Schedule Quote Post"**
4. Redirected to new post page
5. Event pre-filled as quote
6. Add your commentary
7. Schedule or post immediately

**Quote format:**

- Original event referenced
- Your commentary added
- Posted as new event

### Schedule Repost (Kind 6)

**What it does:**

- Creates a repost (kind 6)
- Shares original event
- No additional commentary

**How to use:**

1. Search for event
2. View search results
3. Click **"Schedule Repost (Kind 6)"**
4. Redirected to new post page
5. Repost pre-configured
6. Schedule or post immediately

**Repost format:**

- Original event referenced
- Posted as kind 6
- No additional content

---

## Best Practices

### Finding Content

1. **Use event IDs:**

   - Copy from Nostr clients
   - Use nevent1 format when available
   - Verify ID before searching

2. **Check engagement:**

   - Review statistics before sharing
   - Look for high engagement
   - Consider content quality

3. **Verify content:**
   - Read full content
   - Check author credibility
   - Review media attachments

### Scheduling Posts

1. **Quote posts:**

   - Add valuable commentary
   - Provide context
   - Engage with original content

2. **Reposts:**

   - Share quality content
   - Support creators
   - Build your feed

3. **Timing:**
   - Schedule for optimal times
   - Consider your audience
   - Space out reposts

### Content Curation

1. **Quality over quantity:**

   - Share valuable content
   - Avoid spam
   - Maintain feed quality

2. **Engagement analysis:**

   - Use statistics to find trends
   - Identify popular content
   - Learn what resonates

3. **Source verification:**
   - Verify event authenticity
   - Check author reputation
   - Review content carefully

---

## Troubleshooting

### Event Not Found

**Possible causes:**

- Invalid event ID format
- Event doesn't exist
- Event not in Primal cache

**Solutions:**

- Verify event ID format
- Check event on Nostr directly
- Try different event ID
- Wait and retry

### Search Not Working

**Possible causes:**

- Network issues
- Primal cache unavailable
- Invalid input format

**Solutions:**

- Check internet connection
- Verify event ID format
- Try again later
- Contact support if persistent

### Statistics Not Loading

**Possible causes:**

- Statistics not available
- Event too new
- Cache issues

**Solutions:**

- Wait for statistics to load
- Refresh page
- Check event age
- Try again later

---

## Related Documentation

- [Posting Guide](./posting.md) - Creating and scheduling posts
- [Engagement Guide](./engagement.md) - Understanding engagement
- [Settings Guide](./settings.md) - Search configuration

---

**Next:** [Assets Management Guide](./assets.md) → Manage uploaded assets
