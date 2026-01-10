# Templates Guide

**Estimated time:** 15 minutes  
**Difficulty:** Beginner  
**Last updated:** 2026-01-02

Learn how to create and use reusable post templates to streamline your content creation workflow.

---

## Table of Contents

- [Overview](#overview)
- [Creating Templates](#creating-templates)
- [Using Templates](#using-templates)
- [Template Variables](#template-variables)
- [Template Types](#template-types)
- [Best Practices](#best-practices)

---

## Overview

Templates allow you to create reusable post structures with placeholders for dynamic content. Use
templates for:

- **Weekly announcements** - Regular updates
- **Product launches** - Consistent format
- **Event promotions** - Standard structure
- **Recurring content** - Evergreen posts

---

## Creating Templates

### Basic Template

1. Go to **Settings** → **Templates**
2. Click **"Create Template"**
3. Enter template details:
   - **Name** - Template identifier
   - **Content** - Template text with variables
   - **Description** - What this template is for

4. **Example:**

```
Weekly Update: {{week}}

Highlights:
- {{highlight1}}
- {{highlight2}}
- {{highlight3}}

Read more: {{link}}

#weeklyupdate #nostr
```

5. Click **"Save Template"**

### Template with Variables

Use `{{variable}}` syntax for placeholders:

```
Product Launch: {{productName}}

{{description}}

Get it now: {{link}}

#productlaunch #{{category}}
```

---

## Using Templates

### From New Post

1. Click **"New Post"**
2. Click **"Use Template"**
3. Select a template
4. Fill in variables:
   - Replace `{{variable}}` with actual values
   - Edit content as needed
5. Post or schedule

### Quick Fill

1. Select template
2. Variables are highlighted
3. Fill in values
4. Content auto-updates

---

## Template Variables

### Variable Syntax

- **Format:** `{{variableName}}`
- **Case-sensitive:** `{{Name}}` ≠ `{{name}}`
- **Spaces allowed:** `{{Product Name}}`

### Common Variables

**Date/Time:**

- `{{date}}` - Current date
- `{{time}}` - Current time
- `{{week}}` - Week number

**Content:**

- `{{title}}` - Post title
- `{{description}}` - Post description
- `{{link}}` - URL link

**Custom:**

- `{{productName}}` - Product name
- `{{eventName}}` - Event name
- `{{category}}` - Category

---

## Template Types

### Text Templates

**Use for:**

- Announcements
- Updates
- News

**Example:**

```
{{title}}

{{content}}

#{{category}}
```

### Image Templates

**Use for:**

- Product showcases
- Event promotions
- Visual content

**Example:**

```
{{caption}}

{{image}}

#{{hashtags}}
```

### Link Templates

**Use for:**

- Article shares
- Resource links
- External content

**Example:**

```
{{title}}

{{description}}

Read more: {{link}}

#{{category}}
```

---

## Best Practices

### Template Design

1. **Keep it flexible:**
   - Use variables for dynamic content
   - Allow customization
   - Don't over-constrain

2. **Make it reusable:**
   - Generic enough for multiple uses
   - Specific enough to be useful
   - Clear variable names

3. **Document variables:**
   - Add descriptions
   - Provide examples
   - List required variables

### Variable Naming

**Good names:**

- `{{productName}}` - Clear and descriptive
- `{{eventDate}}` - Specific purpose
- `{{link}}` - Simple and clear

**Bad names:**

- `{{var1}}` - Not descriptive
- `{{data}}` - Too generic
- `{{x}}` - Unclear purpose

### Template Organization

1. **Group by purpose:**
   - Weekly updates
   - Product launches
   - Event promotions

2. **Name clearly:**
   - "Weekly Update Template"
   - "Product Launch Template"
   - "Event Promotion Template"

3. **Keep updated:**
   - Review regularly
   - Update as needed
   - Remove unused templates

---

## Advanced Features

### Template Inheritance

Create base templates and extend them:

**Base Template:**

```
{{content}}

#{{category}}
```

**Extended Template:**

```
{{title}}

{{content}}

{{link}}

#{{category}}
```

### Conditional Content

Use variables to conditionally include content:

```
{{title}}

{{#if description}}
{{description}}
{{/if}}

#{{category}}
```

---

## Related Documentation

- [Posting Guide](./posting.md) - Create and schedule posts
- [Calendar Guide](./calendar.md) - Visual scheduling
- [Engagement Guide](./engagement.md) - Track interactions

---

**Next:** [Posting Guide](./posting.md) → Learn advanced posting features
