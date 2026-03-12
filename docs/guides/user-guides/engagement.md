# Engagement Guide

**Estimated time:** 15 minutes  
**Difficulty:** Beginner  
**Last updated:** 2025-03-12

Learn how to track and manage engagement with your Nostr posts, including replies, mentions, and
interactions.

---

## Table of Contents

- [Overview](#overview)
- [Searching for Events](#searching-for-events)
- [Engagement Feed](#engagement-feed)
- [Types of Engagement](#types-of-engagement)
- [Engagement Statistics](#engagement-statistics)
- [Scheduling from Search](#scheduling-from-search)
- [Managing Engagement](#managing-engagement)
- [Notifications](#notifications)
- [Best Practices](#best-practices)

---

## Overview

The Engagement Feed helps you track and respond to interactions with your posts on Nostr:

- **Replies** - Responses to your posts
- **Mentions** - When someone mentions your npub
- **Reactions** - Reactions to your posts
- **Reposts** - When someone reposts your content

---

## Searching for Events

SmartFlowSocial's search feature allows you to find Nostr events, view engagement statistics, and
schedule quote posts or reposts.

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

### Viewing Search Results

**Event Information:**

- **Author Details** - Profile picture, name, creation date
- **Event Content** - Full text content, formatted display
- **Media Preview** - Extracted images/videos (up to 6 visible)
- **Event ID** - Full event ID displayed, copyable

**Event Metadata:**

- **Created at** - When event was created
- **Kind** - Event type (1 = note, 6 = repost, etc.)
- **Author** - Event creator
- **Content** - Event text content
- **Tags** - Event tags (if any)

---

## Engagement Statistics

### Statistics Displayed

When viewing search results or your own posts, you can see:

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
- Total sats zapped

**Mentions:**

- Number of mentions
- References to event

**Statistics Grid:**

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

### Search Best Practices

**Finding Content:**

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

**Scheduling Posts:**

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

---

## Engagement Feed

### Accessing the Feed

1. Click **"Engagement"** in the navigation
2. View all interactions in chronological order
3. Filter by type (replies, mentions, reactions)

### Feed Features

- **Chronological View** - Latest interactions first
- **Grouped by Post** - See all engagement for a post
- **User Profiles** - View profile information
- **Quick Actions** - Reply, like, or view thread

---

## Viewing threads

A **thread** is the conversation under a single note: the root note and its replies in order.
SmartFlowSocial can load and show a thread so you can read the full context before replying.

**How to open a thread:**

1. From the **Engagement** feed, click a reply or the "View thread" (or "View note") action on an
   item.
2. The app loads the thread (root event plus replies) and displays it in a threaded view.
3. You can scroll through the conversation and use **Reply** to answer from the app.

**What the thread view shows:**

- The root note (the post that started the conversation)
- Replies in chronological or threaded order
- Option to reply, like, or open the note in your preferred Nostr client

Thread data is fetched from the cache/relays (see
[API: thread-view](../reference/api.md#thread-view) for the backend endpoint). If a thread is long,
only part of it may be loaded.

---

## Types of Engagement

### Replies

**What they are:**

- Responses to your posts
- Threaded conversations
- Direct responses

**How to view:**

1. Go to **Engagement** feed
2. Filter by **Replies**
3. Click on a reply to view thread (see [Viewing threads](#viewing-threads))

**How to respond:**

1. Click **"Reply"** on the engagement item
2. Write your response
3. Post immediately or schedule

### Mentions

**What they are:**

- When someone mentions your npub
- References to your account
- Tagged in conversations

**How to view:**

1. Go to **Engagement** feed
2. Filter by **Mentions**
3. See all mentions in chronological order

**How to respond:**

1. Click on the mention
2. View the context
3. Reply if appropriate

### Reactions

**What they are:**

- Likes, upvotes, or other reactions
- Positive feedback
- Engagement indicators

**How to view:**

1. Go to **Engagement** feed
2. Filter by **Reactions**
3. See who reacted to your posts

### Reposts

**What they are:**

- When someone reposts your content
- Shares of your posts
- Amplification of your message

**How to view:**

1. Go to **Engagement** feed
2. Filter by **Reposts**
3. See who reposted your content

---

## Managing Engagement

### Responding to Replies

1. **View the reply:**
   - Click on the engagement item
   - See full context and thread

2. **Write your response:**
   - Click **"Reply"**
   - Write your message
   - Include relevant hashtags

3. **Post or schedule:**
   - **Post Now** - Immediate response
   - **Schedule** - Plan for later

### Engaging with Mentions

1. **Review the mention:**
   - Check the context
   - Understand why you were mentioned

2. **Decide on response:**
   - Reply if relevant
   - Acknowledge if appropriate
   - Ignore if not relevant

3. **Take action:**
   - Reply directly
   - Create a new post
   - Schedule a response

### Tracking Engagement Metrics

**Available metrics:**

- Total replies
- Total mentions
- Total reactions
- Total reposts
- Engagement rate

**How to view:**

1. Go to **Dashboard**
2. View **Engagement Statistics**
3. See metrics over time

---

## Notifications

### Notification Types

- **New replies** - When someone replies to your post
- **New mentions** - When someone mentions you
- **New reactions** - When someone reacts to your post
- **New reposts** - When someone reposts your content

### Notification Settings

1. Go to **Settings** → **Notifications**
2. Configure notification preferences
3. Choose which engagements to track

---

## Best Practices

### Responding to Engagement

1. **Be timely:**
   - Respond within 24-48 hours
   - Use scheduling for planned responses
   - Set aside time for engagement

2. **Be authentic:**
   - Write genuine responses
   - Add value to conversations
   - Be helpful and friendly

3. **Be strategic:**
   - Prioritize important engagements
   - Use templates for common responses
   - Track engagement patterns

### Building Engagement

1. **Ask questions:**
   - Encourage replies
   - Start conversations
   - Engage with your audience

2. **Respond to comments:**
   - Acknowledge replies
   - Answer questions
   - Thank supporters

3. **Track what works:**
   - Monitor engagement metrics
   - Identify popular content
   - Adjust strategy accordingly

---

## Related Documentation

- [Posting Guide](./posting.md) - Create and schedule posts (includes templates)
- [Calendar Guide](./calendar.md) - Visual scheduling

---

**Next:** [Posting Guide](./posting.md) → Learn about templates and advanced posting
