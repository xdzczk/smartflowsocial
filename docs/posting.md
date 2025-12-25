# Posting Workflow Guide

This comprehensive guide covers all the ways you can create, manage, and optimize posts in SmartFlowSocial.

## Table of Contents

- [Overview](#overview)
- [Post Types](#post-types)
- [Creating Posts](#creating-posts)
- [Scheduling Posts](#scheduling-posts)
- [Bulk Operations](#bulk-operations)
- [Managing Posts](#managing-posts)
- [Queue Types](#queue-types)
- [Long-form Posts](#long-form-posts)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

SmartFlowSocial supports multiple ways to create and publish content to Nostr:

- **Instant Posting**: Publish immediately
- **Scheduled Posts**: Plan content in advance
- **Bulk Upload**: Schedule multiple posts at once
- **Drafts**: Save work-in-progress
- **Templates**: Reuse post structures
- **Recyclables**: Reuse evergreen content

All posts are signed client-side using your Nostr extension (NIP-07) before being published to relays.

---

## Post Types

### Text Posts

Plain text posts without media attachments.

**Use Cases:**
- Quick thoughts and updates
- Text-only announcements
- Thread starters
- Status updates

**Limitations:**
- No media attachments
- Text only

**Example:**
```
Just shipped a new feature! 🚀

#nostr #bitcoin #lightning
```

### Image Posts

Single image with optional caption.

**Supported Formats:**
- JPEG/JPG
- PNG
- WebP
- GIF

**File Size Limits:**
- Recommended: < 10MB
- Maximum: Depends on storage provider

**Use Cases:**
- Photo sharing
- Screenshots
- Infographics
- Memes

**Best Practices:**
- Optimize images before upload
- Use descriptive captions
- Include relevant hashtags
- Consider image dimensions (square works well)

### Carousel Posts

Multiple images in a single post.

**Limitations:**
- Maximum images: Varies by plan
- All images in one post
- Shared caption

**Use Cases:**
- Product showcases
- Step-by-step guides
- Photo series
- Before/after comparisons

**How to Create:**
1. Select "Carousel" post type
2. Upload multiple images
3. Arrange images in desired order
4. Add caption for entire carousel
5. Post or schedule

### Video Posts

Video URL embedded in post.

**Supported Platforms:**
- YouTube
- Vimeo
- Direct video URLs (MP4, WebM)

**Format:**
```
Check out this video: https://youtube.com/watch?v=...

#video #tutorial
```

**Note:** Nostr doesn't natively support video embedding. Videos are shared as links with preview cards.

### Long-form Posts (Articles)

Full articles with rich text formatting (NIP-23).

**Features:**
- Rich text editor (EditorJS)
- Headers, paragraphs, lists
- Code blocks
- Images
- Links and quotes
- Cover image
- Summary
- Topic tags

**Use Cases:**
- Blog posts
- Tutorials
- Documentation
- News articles
- In-depth analysis

See [Long-form Posts](#long-form-posts) section for details.

---

## Creating Posts

### Instant Post

Publish immediately to Nostr.

**Steps:**

1. **Click "New Post"**
   - From dashboard header
   - Or use keyboard shortcut (if configured)

2. **Select Post Type**
   - Text, Image, Carousel, or Video
   - Choose based on your content

3. **Enter Content**
   - Type your post text
   - Add hashtags manually or select preset
   - Attach images if needed

4. **Preview**
   - Review how post will appear
   - Check formatting
   - Verify media attachments

5. **Click "Post Now"**
   - Confirmation dialog appears
   - Review post one more time
   - Click "Post Now" to confirm

6. **Sign Event**
   - Nostr extension prompts you
   - Review event details:
     - Content
     - Timestamp
     - Kind (1 for regular posts)
   - Click "Sign" to approve

7. **Post Published**
   - Success message appears
   - Post is immediately published to relays
   - Appears in "Posted" section
   - View on Nostr clients

**What Happens:**
- Event is signed with your private key
- Signed event is sent to HTTP Nostr Publisher
- Publisher distributes to your configured relays
- Post appears on Nostr network

### Draft Posts

Save work-in-progress posts for later.

**Creating Drafts:**

1. **Create Post** (steps 1-3 above)
2. **Click "Save as Draft"**
   - Post is saved but not published
   - Can be edited later
3. **Access Drafts**
   - Go to Dashboard → Drafts
   - See all saved drafts

**Editing Drafts:**

1. **Open Drafts Section**
2. **Click on Draft**
3. **Edit Content**
   - Modify text, images, hashtags
   - Change post type if needed
4. **Save Changes**
   - Updates draft
   - Or convert to scheduled/post now

**Converting Drafts:**

- **To Scheduled Post**: Set date/time and schedule
- **To Instant Post**: Click "Post Now"
- **Delete**: Remove draft permanently

---

## Scheduling Posts

### Basic Scheduling

Schedule a single post for future publication.

**Steps:**

1. **Create Post** (steps 1-3 from Instant Post)
2. **Toggle "Schedule for later"**
   - Switch appears below content area
3. **Select Date and Time**
   - Use date/time picker
   - Times in your configured timezone
   - Can't schedule in the past
4. **Optional: Assign to Queue**
   - Select queue type
   - Helps organize content
5. **Click "Schedule Post"**
   - Review scheduled time
   - Confirm scheduling
6. **Sign Event**
   - Sign with Nostr extension
   - Event is signed with scheduled timestamp
7. **Post Scheduled**
   - Appears in "Scheduled" section
   - Will publish automatically at scheduled time

**Scheduling Rules:**

- Minimum: 1 minute in the future
- Maximum: No limit (but consider event expiration)
- Timezone: Uses your configured timezone
- Queue: Optional, helps organize

### Queue-Based Scheduling

Assign posts to queues with automatic scheduling rules.

**Queue Types:**

1. **Interval Scheduling**
   - Posts every X hours
   - Calculated from last post time
   - Example: Every 4 hours

2. **Fixed Slots**
   - Posts at specific times daily
   - Example: 9am, 2pm, 7pm

**How It Works:**

1. **Create Queue** (in Settings → Queues)
2. **Configure Schedule Rules**
   - Set interval or fixed times
3. **Assign Post to Queue**
   - Select queue when scheduling
4. **System Calculates Next Time**
   - Based on queue rules
   - Shows preview of scheduled time
5. **Post Scheduled**
   - Follows queue rules
   - Can be manually overridden

See [Queue Types](#queue-types) for detailed information.

---

## Bulk Operations

### Bulk Image Upload

Upload multiple images and schedule them automatically.

**Use Cases:**
- Content creators with many images
- Product catalogs
- Photo series
- Automated posting schedules

**Steps:**

1. **Click "Bulk Posts"**
   - From dashboard navigation
   - Or go to `/dashboard/bulk`

2. **Upload Images**
   - Drag and drop multiple files
   - Or click to select files
   - Supports: JPG, PNG, WebP, GIF

3. **Set Start Date and Time**
   - When to start posting
   - First image posts at this time

4. **Select Posting Interval**
   - Choose from: 2h, 4h, 6h, 12h, 24h
   - Or custom interval
   - Images spaced by this interval

5. **Add Captions** (Optional)
   - Add caption for each image
   - Or use template captions
   - Can edit individually

6. **Preview Posts**
   - Click "Preview X Posts"
   - Review all scheduled posts
   - Check times and captions
   - Make adjustments if needed

7. **Sign and Schedule**
   - Click "Sign and Schedule X Posts"
   - Sign all events with extension
   - All posts scheduled

**Bulk Upload Tips:**

- **Organize Images**: Name files in order
- **Batch Captions**: Use similar captions with variations
- **Check Schedule**: Verify times work for your audience
- **Test First**: Try with 2-3 images first

### Batch Operations

Perform actions on multiple posts at once.

**Available Actions:**

- **Delete**: Remove multiple posts
- **Reschedule**: Move posts to different times
- **Change Queue**: Reassign to different queue
- **Mark as Posted**: Manually mark as published

**How to Use:**

1. **Select Posts**
   - Check boxes next to posts
   - Or "Select All"
2. **Choose Action**
   - From bulk actions menu
3. **Confirm Action**
   - Review affected posts
   - Confirm changes

---

## Managing Posts

### Scheduled Posts

View and manage posts waiting to be published.

**Location:** Dashboard → Scheduled

**Features:**

- **Preview**: See post content and media
- **Edit**: Modify before publishing
- **Reschedule**: Change publication time
- **Delete**: Remove from schedule
- **View Details**: See queue, hashtags, etc.

**Status Indicators:**

- ⏰ **Scheduled**: Waiting to publish
- ✅ **Signed**: Event is signed and ready
- ⚙️ **Auto-scheduled**: Part of queue system
- 🔄 **Pending Sign**: Needs re-signing

**Rescheduling:**

1. **Click on Post**
2. **Click "Reschedule"**
3. **Select New Time**
4. **Confirm**
5. **Re-sign Event** (if time changed)

### Posted History

View all published posts.

**Location:** Dashboard → Posted

**Information Displayed:**

- **Nostr Event ID**: Unique identifier
- **Published Time**: When it was posted
- **Content Preview**: Post text and media
- **Engagement**: Likes, replies, reposts (if available)
- **View on Nostr**: Link to view on Nostr clients

**Actions:**

- **View Details**: See full post information
- **Copy Event ID**: Copy for sharing
- **View on Nostr**: Open in Nostr client
- **Recycle**: Mark as recyclable for reuse

### Drafts

Save and manage work-in-progress posts.

**Location:** Dashboard → Drafts

**Features:**

- **Continue Editing**: Resume work on drafts
- **Convert to Post**: Publish or schedule
- **Delete**: Remove drafts
- **Duplicate**: Create copy of draft

**Draft Management Tips:**

- **Name Drafts**: Use descriptive names
- **Organize**: Group related drafts
- **Review Regularly**: Clean up old drafts
- **Use Templates**: Convert good drafts to templates

### Recyclables

Reuse evergreen content.

**What are Recyclables?**

Posts marked as recyclable can be:
- Rescheduled for future dates
- Reused multiple times
- Great for evergreen content

**Marking Posts as Recyclable:**

1. **Create or Edit Post**
2. **Toggle "Recyclable"**
3. **Save or Publish**

**Reusing Recyclables:**

1. **Go to Recyclables Section**
2. **Select Post**
3. **Click "Reschedule"**
4. **Set New Date/Time**
5. **Re-sign Event**
6. **Post Scheduled**

**Best Use Cases:**

- Weekly announcements
- Product features
- Educational content
- Regular updates
- Seasonal content

---

## Queue Types

Queues help organize content with different scheduling rules.

### Interval Scheduling

Posts automatically every X hours from the last post.

**Configuration:**

1. **Create Queue** (Settings → Queues)
2. **Select "Interval" Schedule Type**
3. **Set Interval** (e.g., 4 hours)
4. **Save Queue**

**How It Works:**

- First post in queue: Uses specified time
- Subsequent posts: Calculated from last post time
- Example: Every 4 hours
  - Post 1: 10:00 AM
  - Post 2: 2:00 PM (4 hours later)
  - Post 3: 6:00 PM (4 hours later)

**Use Cases:**

- Regular content updates
- News feeds
- Automated posting
- Consistent engagement

### Fixed Slots

Posts at specific times each day.

**Configuration:**

1. **Create Queue** (Settings → Queues)
2. **Select "Fixed Slots" Schedule Type**
3. **Add Time Slots** (e.g., 9am, 2pm, 7pm)
4. **Save Queue**

**How It Works:**

- Posts are scheduled at exact times
- If slot is full, uses next available slot
- Example: 9am, 2pm, 7pm daily
  - Post 1: Today 9:00 AM
  - Post 2: Today 2:00 PM
  - Post 3: Today 7:00 PM
  - Post 4: Tomorrow 9:00 AM

**Use Cases:**

- Peak engagement times
- Scheduled content blocks
- Time-specific campaigns
- Regular daily posts

### Queue Management

**Creating Queues:**

1. **Go to Settings → Queues**
2. **Click "New Queue"**
3. **Configure:**
   - Name
   - Schedule type
   - Schedule rules
   - Default hashtag preset
   - Color (for calendar view)
4. **Save**

**Queue Features:**

- **Multiple Queues**: Create queues for different topics
- **Queue Limits**: Some plans limit queue count
- **Default Queue**: Set one as default
- **Queue Colors**: Visual organization

---

## Long-form Posts

Full articles with rich text formatting (NIP-23).

### Creating Long-form Posts

**Steps:**

1. **Click "New Long-form Post"**
   - From dashboard navigation

2. **Enter Title**
   - Article title
   - Used in NIP-23 event

3. **Add Summary** (Optional)
   - Brief description
   - Shown in previews

4. **Write Content**
   - Use rich text editor
   - Supports:
     - Headers (H1-H6)
     - Paragraphs
     - Lists (ordered, unordered)
     - Code blocks
     - Quotes
     - Links
     - Images

5. **Add Cover Image** (Optional)
   - Upload cover image
   - Shown in article previews

6. **Add Topic Tags**
   - Enter topic tags
   - Used for categorization

7. **Schedule or Publish**
   - Publish immediately
   - Or schedule for later

8. **Sign NIP-23 Event**
   - Sign with Nostr extension
   - Event kind: 30023

### Editor Features

**Text Formatting:**

- **Headers**: H1-H6 for structure
- **Bold/Italic**: Text emphasis
- **Lists**: Ordered and unordered
- **Code Blocks**: Syntax highlighting
- **Quotes**: Block quotes
- **Links**: Hyperlinks

**Media:**

- **Images**: Upload and embed
- **Videos**: Embed video URLs
- **Cover Image**: Article thumbnail

**Advanced:**

- **Markdown Support**: Can paste markdown
- **Export**: Export as markdown
- **Import**: Import from markdown

### Long-form Best Practices

1. **Structure**: Use headers for organization
2. **Length**: Optimal length varies by topic
3. **Images**: Include relevant images
4. **Tags**: Use descriptive topic tags
5. **Summary**: Write compelling summaries
6. **Cover**: Use engaging cover images

---

## Advanced Features

### Templates

Save reusable post structures.

**Creating Templates:**

1. **Create Post**
2. **Click "Save as Template"**
3. **Name Template**
4. **Save**

**Using Templates:**

1. **Click "New Post from Template"**
2. **Select Template**
3. **Fill in Placeholders**
4. **Post or Schedule**

**Template Features:**

- **Placeholders**: Variables in templates
- **Reusability**: Use multiple times
- **Organization**: Group by category

### Hashtag Presets

Reusable hashtag collections.

**Creating Presets:**

1. **Go to Settings → Hashtags**
2. **Click "New Preset"**
3. **Enter Name and Hashtags**
4. **Save**

**Using Presets:**

- **In Posts**: Select from dropdown
- **In Queues**: Assign to queue
- **Combining**: Use multiple presets

### Post Analytics

Track post performance (if available).

**Metrics:**

- **Engagement**: Likes, replies, reposts
- **Reach**: Views, impressions
- **Timing**: Best posting times

**Access:**

- View in Posted section
- Click on post for details
- See engagement metrics

---

## Best Practices

### Content Creation

1. **Consistency**: Post regularly
2. **Quality**: Focus on valuable content
3. **Timing**: Post when audience is active
4. **Hashtags**: Use relevant hashtags
5. **Media**: Include images when possible

### Scheduling

1. **Plan Ahead**: Schedule content in advance
2. **Use Queues**: Organize with queues
3. **Time Zones**: Consider audience timezone
4. **Spacing**: Don't post too frequently
5. **Review**: Check scheduled posts regularly

### Optimization

1. **Images**: Optimize before upload
2. **Hashtags**: Use presets for consistency
3. **Templates**: Save time with templates
4. **Recyclables**: Reuse evergreen content
5. **Bulk Operations**: Use for efficiency

### Engagement

1. **Respond**: Reply to comments
2. **Monitor**: Track engagement
3. **Adjust**: Adapt based on performance
4. **Experiment**: Try different content types
5. **Analyze**: Review what works

---

## Troubleshooting

### Post Creation Issues

**Problem: Can't Upload Images**

**Solutions:**
- Check file size (should be < 10MB)
- Verify file format (JPG, PNG, WebP)
- Check storage provider configuration
- Clear browser cache
- Try different browser

**Problem: Signing Fails**

**Solutions:**
- Check extension is unlocked
- Verify extension permissions
- Try signing again
- Check browser console
- Try different extension

**Problem: Post Not Publishing**

**Solutions:**
- Check relay configuration
- Verify relays are accessible
- Check network connection
- Review error messages
- Try publishing again

### Scheduling Issues

**Problem: Posts Not Publishing at Scheduled Time**

**Solutions:**
- Check worker process is running
- Verify Redis connection
- Check post has signed event
- Verify scheduled time is correct
- Check queue configuration

**Problem: Can't Reschedule**

**Solutions:**
- Verify post is in Scheduled section
- Check post hasn't already published
- Ensure new time is in future
- Re-sign event if needed

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for more solutions.

---

## Additional Resources

- [Onboarding Guide](./onboarding.md) - Getting started
- [Calendar Feature](./calendar-feature.md) - Visual scheduling
- [Nostr Integration](./NOSTR_INTEGRATION.md) - Protocol details
- [API Reference](./api-reference.md) - API endpoints
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues

---

Happy posting! 🚀
