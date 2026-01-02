# Recipes

**Last updated:** 2026-01-02

Common use case patterns and recipes for SmartFlowSocial.

---

## Table of Contents

- [Scheduled Daily Posts](#scheduled-daily-posts)
- [Bulk Image Upload](#bulk-image-upload)
- [Weekly Newsletter](#weekly-newsletter)
- [Event Promotion](#event-promotion)
- [Product Launch](#product-launch)
- [Engagement Response](#engagement-response)

---

## Scheduled Daily Posts

**Use case:** Post at the same time every day.

### Setup

1. **Create Fixed Time Queue:**
   - Go to **Settings** → **Queues**
   - Create queue with type **"Fixed Time Slots"**
   - Set times: `9:00 AM`, `12:00 PM`, `5:00 PM`
   - Set timezone

2. **Create Posts:**
   - Go to **New Post**
   - Write your content
   - Select the queue
   - Click **"Schedule"**

3. **Posts automatically scheduled:**
   - Queue calculates next available slot
   - Posts distributed across time slots
   - Consistent daily posting

---

## Bulk Image Upload

**Use case:** Upload and schedule multiple images at once.

### Steps

1. **Prepare images:**
   - Optimize images (compress, resize)
   - Name files descriptively
   - Organize in folder

2. **Bulk upload:**
   - Go to **New Post**
   - Click **"Bulk Upload"**
   - Select multiple images
   - Set interval (e.g., every 6 hours)

3. **Auto-scheduling:**
   - Images uploaded to storage
   - Posts created automatically
   - Scheduled with intervals

---

## Weekly Newsletter

**Use case:** Send weekly update every Monday.

### Setup

1. **Create template:**
   ```
   Weekly Update: {{week}}
   
   Highlights:
   - {{highlight1}}
   - {{highlight2}}
   - {{highlight3}}
   
   Read more: {{link}}
   
   #weeklyupdate #nostr
   ```

2. **Schedule weekly:**
   - Use template
   - Fill in variables
   - Schedule for Monday 9 AM
   - Set as recyclable

3. **Automate:**
   - Create recurring schedule
   - Update variables weekly
   - Posts publish automatically

---

## Event Promotion

**Use case:** Promote an event with multiple posts.

### Strategy

1. **Announcement (2 weeks before):**
   - "Save the date" post
   - Include event details
   - Link to event page

2. **Reminder (1 week before):**
   - Reminder post
   - Highlight key details
   - Include registration link

3. **Countdown (3 days before):**
   - Daily countdown posts
   - Build anticipation
   - Share updates

4. **Day of event:**
   - Live updates
   - Share highlights
   - Engage with attendees

### Implementation

1. **Create posts:**
   - Write all posts in advance
   - Schedule at optimal times
   - Use consistent hashtags

2. **Use calendar:**
   - Visual scheduling
   - Drag to adjust times
   - See full timeline

---

## Product Launch

**Use case:** Launch a product with coordinated posts.

### Timeline

**Week 1: Teaser**
- Teaser posts
- Build anticipation
- Share hints

**Week 2: Preview**
- Preview content
- Behind-the-scenes
- Early access info

**Week 3: Launch**
- Launch announcement
- Product details
- Purchase link

**Week 4: Follow-up**
- User testimonials
- Use cases
- Support information

### Template

```
Product Launch: {{productName}}

{{description}}

Features:
- {{feature1}}
- {{feature2}}
- {{feature3}}

Get it now: {{link}}

#productlaunch #{{category}}
```

---

## Engagement Response

**Use case:** Respond to engagement efficiently.

### Workflow

1. **Review engagement:**
   - Check engagement feed daily
   - Prioritize important interactions
   - Identify common questions

2. **Create response templates:**
   - Thank you messages
   - FAQ responses
   - Support replies

3. **Schedule responses:**
   - Batch responses
   - Schedule for optimal times
   - Personalize as needed

### Best Practices

- **Respond within 24-48 hours**
- **Personalize when possible**
- **Use templates for efficiency**
- **Track engagement patterns**

---

## Related Documentation

- [Posting Guide](../guides/user-guides/posting.md) - Complete posting guide
- [Templates Guide](../guides/user-guides/templates.md) - Reusable templates
- [Calendar Guide](../guides/user-guides/calendar.md) - Visual scheduling
- [Code Samples](./code-samples.md) - Code examples

---

**Next:** [Code Samples](./code-samples.md) → View code examples

