# Long-form Articles

**Estimated time:** 35 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-02

Complete guide to creating, formatting, and publishing long-form articles using NIP-23 (Kind 30023) in SmartFlowSocial.

---

## Prerequisites

- ✅ Account created and logged in
- ✅ Completed [Creating Your First Post](../beginner/creating-your-first-post.md)
- ✅ Basic plan or higher (long-form posts available on paid plans)
- ✅ Understanding of rich text editing

---

## What are Long-form Articles?

**Long-form articles are:**

- Full-length articles (NIP-23, Kind 30023)
- Rich text formatted content
- Structured with headers, lists, images
- Published as standalone articles
- Different from regular posts (Kind 1)

**Benefits:**

- Detailed content sharing
- Better formatting options
- Professional presentation
- Enhanced readability
- Article-specific features

---

## Step 1: Navigate to Long-form Editor

1. **Click "New Long-form Post"** in navigation
   - Or go to `/dashboard/newlongformpost`
2. **Long-form editor** opens
3. **Editor interface** ready

---

## Step 2: Enter Article Title

1. **Click in title field**
2. **Enter article title:**
   ```
   Complete Guide to Nostr Protocol
   ```

**Title best practices:**

- Clear and descriptive
- SEO-friendly
- Engaging and compelling
- 50-60 characters ideal

---

## Step 3: Write Summary

1. **Click in summary field**
2. **Enter brief summary:**
   ```
   Learn everything you need to know about the Nostr protocol, from basics to advanced features.
   ```

**Summary best practices:**

- 1-2 sentences
- Compelling preview
- Include key points
- Encourage reading

---

## Step 4: Write Article Content

**Using the rich text editor:**

1. **Click in editor area**
2. **Start writing:**
   - Type directly
   - Or paste from another editor
   - Format as you go

**Editor features:**

**Text formatting:**

- **Headers:** H1-H6 for structure
- **Bold/Italic:** Text emphasis
- **Lists:** Ordered and unordered
- **Code blocks:** Syntax highlighting
- **Quotes:** Block quotes
- **Links:** Hyperlinks

**Media:**

- **Images:** Upload and embed
- **Videos:** Embed video URLs
- **Cover Image:** Article thumbnail

**Advanced:**

- **Markdown Support:** Can paste markdown
- **Export:** Export as markdown
- **Import:** Import from markdown

---

## Step 5: Structure Your Article

### Using Headers

**Create article structure:**

1. **H1:** Main title (usually auto-filled)
2. **H2:** Major sections
3. **H3:** Subsections
4. **H4-H6:** Further nesting

**Example structure:**

```
# Main Title (H1)

## Introduction (H2)

## Section 1 (H2)
### Subsection 1.1 (H3)
### Subsection 1.2 (H3)

## Section 2 (H2)
### Subsection 2.1 (H3)

## Conclusion (H2)
```

### Using Lists

**Ordered lists:**

- Step-by-step instructions
- Numbered sequences
- Sequential processes

**Unordered lists:**

- Feature lists
- Bullet points
- Non-sequential items

### Using Code Blocks

**For technical content:**

- Code examples
- Configuration snippets
- Command examples
- Syntax highlighting

---

## Step 6: Add Cover Image

1. **Click "Upload Cover Image"** or image area
2. **Select image:**
   - Choose from computer
   - Or select from assets
3. **Image uploads:**
   - Appears as cover
   - Shown in previews
   - Used in article cards

**Cover image best practices:**

- High quality (1080x1080px or larger)
- Relevant to content
- Engaging and eye-catching
- Optimized file size

---

## Step 7: Add Topic Tags

1. **Click in tags field**
2. **Enter topic tags:**
   - Comma or space separated
   - Example: `nostr, bitcoin, lightning, tutorial`
   - Used for categorization

**Tag best practices:**

- Use relevant tags
- Include 3-5 tags
- Mix broad and specific
- Research popular tags

---

## Step 8: Configure Publishing Options

**Queue selection:**

1. **Select queue** (optional)
   - Choose from dropdown
   - Or leave as "Unassigned"
   - Queue rules apply

**Hashtag presets:**

1. **Toggle "Use Hashtag Preset"** (optional)
2. **Select preset** from dropdown
3. **Preset tags applied**

**Scheduling:**

1. **Toggle "Schedule for later"**
2. **Select date and time**
3. **Or publish immediately**

---

## Step 9: Preview Article

1. **Click "Preview"** button
2. **Review article:**

   - Check formatting
   - Verify images
   - Review structure
   - Check spelling

3. **Make adjustments:**
   - Edit content
   - Fix formatting
   - Update images
   - Refine tags

---

## Step 10: Publish or Schedule

**Option 1: Publish Immediately**

1. **Click "Publish"** button
2. **Sign with Nostr Extension:**
   - Extension popup appears
   - Review event details
   - Event kind: 30023 (NIP-23)
   - Sign event
3. **Article published!**
   - Appears on Nostr
   - Visible in article clients
   - Can be shared

**Option 2: Schedule**

1. **Toggle "Schedule for later"**
2. **Select date and time**
3. **Click "Schedule Article"**
4. **Sign with extension**
5. **Article scheduled!**

---

## Editor Tips and Tricks

### Keyboard Shortcuts

**Common shortcuts:**

- **Ctrl/Cmd + B:** Bold
- **Ctrl/Cmd + I:** Italic
- **Ctrl/Cmd + K:** Insert link
- **Ctrl/Cmd + Shift + H:** Header
- **Tab:** Indent list item

### Markdown Support

**Paste markdown:**

- Editor converts markdown
- Preserves formatting
- Supports most markdown syntax

**Export markdown:**

- Export article as markdown
- Use in other editors
- Backup content

### Image Management

**Upload images:**

- Click image button
- Upload from computer
- Or select from assets
- Images embedded in content

**Image best practices:**

- Optimize before upload
- Use appropriate sizes
- Include alt text
- Space images throughout

---

## Article Best Practices

### Structure

1. **Clear hierarchy:**

   - Use headers properly
   - Logical flow
   - Easy navigation

2. **Readable length:**

   - Optimal: 1000-2000 words
   - Can be longer if needed
   - Break into sections

3. **Visual elements:**
   - Include images
   - Use lists
   - Add code blocks
   - Break up text

### Content Quality

1. **Valuable content:**

   - Provide value
   - Be informative
   - Answer questions
   - Share knowledge

2. **Engaging writing:**

   - Clear and concise
   - Engaging tone
   - Good flow
   - Proper grammar

3. **Original content:**
   - Write original articles
   - Cite sources
   - Add your perspective
   - Provide insights

### Formatting

1. **Consistent style:**

   - Use headers consistently
   - Format lists properly
   - Style code blocks
   - Maintain formatting

2. **Readability:**
   - Short paragraphs
   - White space
   - Clear sections
   - Visual breaks

---

## NIP-23 Technical Details

### Event Structure

**Kind 30023:**

- Article event type
- Includes title, summary, image
- Rich content support
- Article-specific tags

**Event Tags:**

- `["d", identifier]` - Article identifier
- `["title", title]` - Article title
- `["summary", summary]` - Article summary
- `["image", url]` - Cover image URL
- `["published_at", timestamp]` - Publication time
- `["t", tag]` - Topic tags

### Article Identifier

**Generated from:**

- Title
- Author pubkey
- Creates unique identifier
- Used for updates

---

## Editing Published Articles

### Update Article

1. **Find article** in dashboard
2. **Click "Edit"**
3. **Make changes:**
   - Update content
   - Modify title/summary
   - Change images
   - Update tags
4. **Save changes**
5. **Re-sign event** if needed

**Note:** Updates create new event with same identifier

---

## Troubleshooting

### Editor Not Loading

**Problem:** Editor doesn't appear

**Solutions:**

- Refresh page
- Check browser compatibility
- Clear browser cache
- Try different browser

### Formatting Lost

**Problem:** Formatting disappears

**Solutions:**

- Check editor mode
- Verify markdown support
- Re-apply formatting
- Use editor tools

### Images Not Uploading

**Problem:** Images won't upload

**Solutions:**

- Check file size
- Verify format
- Check upload provider
- Try different image

### Publishing Fails

**Problem:** Article won't publish

**Solutions:**

- Check extension is connected
- Verify event signing
- Check network connection
- Review error messages

---

## What You Learned

✅ How to create long-form articles  
✅ How to use the rich text editor  
✅ How to structure articles  
✅ How to add cover images and tags  
✅ How to publish and schedule articles  
✅ NIP-23 technical details

---

## Next Steps

1. **[Advanced Queue Management](../advanced/advanced-queue-management.md)** - Master queue systems
2. **[Custom Integrations](../advanced/custom-integrations.md)** - Build integrations
3. **[API Usage](../advanced/api-usage.md)** - Use the API

---

## Related Documentation

- [Posting Guide](../../guides/user-guides/posting.md) - Complete posting reference
- [Settings Guide](../../guides/user-guides/settings.md) - Queue configuration
- [Nostr Integration](../../reference/nostr.md) - NIP-23 details

---

**Next Tutorial:** [Custom Integrations](../advanced/custom-integrations.md) → Build integrations
