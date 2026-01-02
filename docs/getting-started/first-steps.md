# First Steps Guide

**Estimated time:** 30 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Your first 30 minutes with SmartFlowSocial. Learn the basics and create your first scheduled post.

---

## Overview

This guide will walk you through:
1. Logging in with Nostr
2. Understanding the dashboard
3. Creating your first post
4. Scheduling a post
5. Managing your queue

---

## Step 1: Log In (2 minutes)

### Prerequisites

You need a **Nostr browser extension** installed:
- [Alby](https://getalby.com/) (Recommended)
- [nos2x](https://github.com/fiatjaf/nos2x)
- [Amber](https://amber.app/)

### Login Process

1. Open SmartFlowSocial at `http://localhost:3000` (or your deployment URL)
2. Click **"Log in with Nostr"**
3. Your Nostr extension will prompt you to sign a challenge
4. Approve the request
5. You're logged in! 🎉

**What happens:**
- SmartFlowSocial creates a session cookie
- Your public key (npub) is stored in the session
- You can now create and manage posts

> **Security Note:** Your private key (nsec) never leaves your browser. All events are signed client-side using NIP-07.

---

## Step 2: Explore the Dashboard (5 minutes)

### Main Navigation

The dashboard has several sections:

- **Dashboard** - Overview of your posts and stats
- **New Post** - Create a new post
- **Scheduled** - View scheduled posts
- **Calendar** - Visual scheduling interface
- **Posted** - View published posts
- **Drafts** - Save work-in-progress
- **Engagement** - Track replies and mentions
- **Settings** - Configure your account

### Dashboard Overview

The dashboard shows:
- **Post Statistics** - Total, scheduled, posted, drafts
- **Recent Activity** - Latest posts and engagements
- **Queue Status** - Active queues and next scheduled time
- **Quick Actions** - Common tasks

---

## Step 3: Create Your First Post (10 minutes)

### Instant Post

1. Click **"New Post"** in the navigation
2. Enter your post content:
   ```
   Hello Nostr! 👋
   
   Just set up SmartFlowSocial to manage my posts.
   
   #nostr #bitcoin #lightning
   ```
3. Click **"Post Now"**
4. Approve the signing request in your Nostr extension
5. Your post is published! ✅

### Post with Image

1. Click **"New Post"**
2. Enter your caption
3. Click **"Add Image"** and select a file
4. Wait for upload to complete
5. Click **"Post Now"**
6. Approve signing request
7. Post published with image! 📸

---

## Step 4: Schedule Your First Post (10 minutes)

### Create a Scheduled Post

1. Click **"New Post"**
2. Enter your content:
   ```
   Scheduled post! 🕐
   
   This was scheduled in advance.
   
   #nostr #scheduling
   ```
3. Click **"Schedule"** instead of "Post Now"
4. Select a date and time
5. Choose a queue (or use default)
6. Click **"Schedule Post"**
7. Approve signing request
8. Post is scheduled! 📅

### View Scheduled Posts

1. Click **"Scheduled"** in navigation
2. See your scheduled post in the list
3. Posts are sorted by scheduled time
4. You can edit or delete before publishing

---

## Step 5: Use the Calendar View (5 minutes)

### Visual Scheduling

1. Click **"Calendar"** in navigation
2. See your scheduled posts on a calendar
3. **Drag and drop** posts to reschedule
4. Switch between **Week** and **Month** views
5. Click a post to edit or delete

### Calendar Features

- **Drag to reschedule** - Move posts to different times
- **Color coding** - Different colors for different queues
- **Quick add** - Click empty slot to create new post
- **Bulk operations** - Select multiple posts

---

## Step 6: Manage Your Queue (3 minutes)

### Understanding Queues

Queues control how posts are scheduled:
- **Interval Queue** - Post every X hours
- **Fixed Time Slots** - Post at specific times daily
- **Manual** - Schedule individually

### Create a Queue

1. Go to **Settings** → **Queues**
2. Click **"Create Queue"**
3. Choose queue type:
   - **Interval**: Post every 6 hours
   - **Fixed Slots**: Post at 9 AM and 5 PM daily
4. Set timezone
5. Save queue

### Assign Posts to Queue

When scheduling a post:
1. Select your queue from the dropdown
2. Post will be scheduled according to queue rules
3. Or override with manual time

---

## What You've Learned

✅ Logged in with Nostr  
✅ Explored the dashboard  
✅ Created an instant post  
✅ Scheduled a post  
✅ Used the calendar view  
✅ Created a queue  

---

## Next Steps

### Continue Learning

- **[Posting Guide](../guides/user-guides/posting.md)** - Advanced posting features
- **[Calendar Guide](../guides/user-guides/calendar.md)** - Calendar features
- **[Templates Guide](../guides/user-guides/templates.md)** - Reusable templates
- **[Engagement Guide](../guides/user-guides/engagement.md)** - Track interactions

### Advanced Features

- **Bulk Upload** - Upload multiple images at once
- **Long-form Posts** - Write full articles (NIP-23)
- **Templates** - Reusable post structures
- **Recyclable Posts** - Reuse evergreen content
- **Multi-Account** - Manage parent/child accounts

---

## Common Questions

### How do posts get published?

Scheduled posts are stored in a queue. A background worker process checks the queue and publishes posts at their scheduled time to Nostr relays.

### Can I edit a scheduled post?

Yes! Go to **Scheduled**, click on a post, and edit it. Changes are saved and will be published at the scheduled time.

### What happens if I delete a scheduled post?

The post is removed from the queue and won't be published. This action cannot be undone.

### How do I know when a post was published?

Go to **Posted** to see all published posts with timestamps and engagement metrics.

---

## Troubleshooting

### Post not publishing

- Check worker process is running: `pnpm start:worker`
- Verify Redis connection
- Check post is in "Scheduled" status
- Review worker logs for errors

### Image upload failed

- Check storage configuration in `.env`
- Verify storage bucket exists
- Check file size limits
- Verify storage credentials

See [Troubleshooting Guide](../troubleshooting/common-issues.md) for more solutions.

---

## Related Documentation

- [Quick Start Guide](./quickstart.md) - 5-minute setup
- [Core Concepts](./concepts.md) - Understand how it works
- [Posting Guide](../guides/user-guides/posting.md) - Complete posting guide
- [Configuration Reference](../reference/configuration.md) - All settings

---

**Next:** [Core Concepts](./concepts.md) → Understand how SmartFlowSocial works

