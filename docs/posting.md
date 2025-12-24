# Posting Workflow

This guide covers all the ways you can create and manage posts in SmartFlowSocial.

## Post Types

| Type | Description |
|------|-------------|
| **Text** | Plain text posts |
| **Image** | Single image with caption |
| **Carousel** | Multiple images in one post |
| **Video** | Video URL embedded in post |
| **Long-form** | Full articles (NIP-23) |

---

## Creating a New Post

### Instant Post

1. Click **"New Post"** from the dashboard
2. Select your post type (Text, Image, or Video)
3. Enter your content
4. (Optional) Attach images by clicking the upload area
5. (Optional) Select a hashtag preset
6. Click **"Post Now"**
7. Sign the event with your Nostr extension
8. Your post is published immediately!

### Scheduled Post

1. Click **"New Post"** from the dashboard
2. Create your content as above
3. Toggle **"Schedule for later"**
4. Select a date and time
5. (Optional) Assign to a queue type
6. Click **"Schedule Post"**
7. Sign the event with your Nostr extension
8. Your post will publish at the scheduled time

---

## Bulk Image Upload

Upload multiple images and create a queue of scheduled posts automatically:

1. Click **"Bulk Posts"** from the dashboard
2. Drag and drop multiple images (or click to select)
3. Set the **start date and time**
4. Select a **posting interval** (2h, 4h, 6h, etc.)
5. Add captions for each image
6. Click **"Preview X Posts"** to review
7. Click **"Sign and Schedule X Posts"**
8. Sign all events with your extension

Posts will be automatically spaced according to your interval.

---

## Managing Posts

### Scheduled Posts

View all scheduled posts at **Dashboard → Scheduled**:
- Preview post content and media
- Edit post before publishing
- Reschedule to a different time
- Delete from queue

### Posted History

View all published posts at **Dashboard → Posted**:
- See Nostr event ID
- View engagement (likes, replies, reposts)
- Link to view on Nostr clients

### Drafts

Save work-in-progress posts at **Dashboard → Drafts**:
- Continue editing later
- Convert to scheduled post
- Delete drafts you no longer need

### Recyclables

Posts marked as recyclable can be reused:
- Originally posted content
- Reschedule for future dates
- Great for evergreen content

---

## Calendar View

Manage posts visually at **Dashboard → Calendar**:

### Weekly View
- Horizontal timeline with hourly slots
- Drag and drop posts to reschedule
- See current time indicator

### Monthly View
- Traditional calendar grid
- Post cards under each date
- Quick overview of content schedule

### Drag-and-Drop Rescheduling
1. Click and hold a post block
2. Drag to desired time slot
3. Confirm the reschedule in the modal
4. Post is automatically re-signed with new timestamp

---

## Queue Types

Create custom queues with different scheduling rules:

### Interval Scheduling
Posts every X hours from the last post time.

**Example:** Post every 4 hours
- Post 1: 10:00 AM
- Post 2: 2:00 PM
- Post 3: 6:00 PM

### Fixed Slots
Posts at specific times each day.

**Example:** Post at 9am, 2pm, and 7pm daily

---

## Long-form Posts (Articles)

Create full articles with the rich text editor:

1. Click **"New Long-form Post"**
2. Enter a title
3. Write content using the block editor:
   - Headers, paragraphs
   - Code blocks
   - Embedded images
   - Links and quotes
4. Add a cover image
5. Schedule or publish immediately
6. Sign the NIP-23 event

---

## Tips for Great Posts

1. **Use hashtag presets** - Consistent tagging helps discovery
2. **Schedule for optimal times** - Consider your audience's timezone
3. **Include media** - Images and videos get more engagement
4. **Preview before posting** - Check how content will appear
5. **Use queues** - Organize content by topic or campaign
