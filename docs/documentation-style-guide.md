# Documentation Style Guide

**Last Updated**: 2025-01-XX  
**Status**: Active

This guide defines the standards, conventions, and best practices for writing and maintaining SmartFlowSocial documentation.

## Table of Contents

1. [Writing Standards](#writing-standards)
2. [Document Structure](#document-structure)
3. [Formatting Guidelines](#formatting-guidelines)
4. [Documentation Template](#documentation-template)
5. [Review Process](#review-process)
6. [Best Practices](#best-practices)

---

## Writing Standards

### Tone and Voice

- **Clear and Concise**: Use simple, direct language
- **Professional but Friendly**: Approachable but authoritative
- **Active Voice**: Prefer active voice over passive
  - ✅ "The system processes requests"
  - ❌ "Requests are processed by the system"
- **Second Person**: Use "you" when addressing the reader
  - ✅ "You can configure the environment variables"
  - ❌ "One can configure the environment variables"

### Language

- **US English**: Use US English spelling (e.g., "color" not "colour")
- **Consistent Terminology**: Use the same terms throughout
  - ✅ "queue system" (consistent)
  - ❌ "queue system" / "queueing system" / "queuing system" (inconsistent)
- **Avoid Jargon**: Explain technical terms on first use
- **Plain Language**: Avoid unnecessary complexity

### Code Examples

- **Working Examples**: All code examples should be functional
- **Complete Examples**: Include necessary imports and setup
- **Comments**: Add comments to explain non-obvious parts
- **Syntax Highlighting**: Use appropriate language tags

```typescript
// ✅ Good example
import { getUserById } from "~/models/user.server";

async function loadUser(userId: string) {
  // Fetch user from database
  const user = await getUserById(userId);
  return user;
}
```

---

## Document Structure

### Standard Sections

Every documentation file should follow this structure:

1. **Title** - Clear, descriptive title
2. **Metadata** - Date, status, last updated
3. **Table of Contents** - For documents > 200 lines
4. **Overview/Introduction** - What this document covers
5. **Main Content** - Organized into logical sections
6. **Examples** - Code examples and use cases
7. **See Also** - Links to related documentation
8. **Additional Resources** - External links and references

### Headings Hierarchy

Use consistent heading levels:

```markdown
# Title (H1) - Document title only
## Major Section (H2) - Main sections
### Subsection (H3) - Subsections
#### Detail (H4) - Detailed topics
```

**Guidelines**:
- Only one H1 per document (the title)
- Use H2 for major sections
- Use H3 for subsections
- Avoid skipping heading levels (don't go from H2 to H4)

---

## Formatting Guidelines

### File Naming

- **Use kebab-case**: `lowercase-with-hyphens.md`
- **Be descriptive**: `error-handling.md` not `errors.md`
- **Use hyphens**: `test-strategy.md` not `test_strategy.md` or `testStrategy.md`

### Links

- **Use relative paths**: `./testing.md` or `../operations/deployment.md`
- **Descriptive link text**: 
  - ✅ `[Testing Guide](./testing.md)`
  - ❌ `[Click here](./testing.md)`
- **Update links**: When moving files, update all references

### Code Blocks

- **Specify language**: Use language tags for syntax highlighting
- **Include context**: Show where code belongs
- **Keep it short**: Extract long examples to separate files if needed

```markdown
✅ Good:
```typescript
// app/models/user.server.ts
export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
```

❌ Bad:
```
getUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}
```
```

### Lists

- **Use consistent markers**: Use `-` for unordered lists
- **Parallel structure**: Keep list items grammatically parallel
- **Nested lists**: Use 2 spaces for indentation

```markdown
✅ Good:
- Configure environment variables
- Start the database
- Run migrations

❌ Bad:
- Configure environment variables
- The database should be started
- Running migrations
```

### Tables

- **Use for structured data**: Comparisons, specifications, status
- **Include headers**: Always include header row
- **Align columns**: Use alignment for readability

```markdown
| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Complete | NIP-07 implemented |
| Posting | ✅ Complete | Supports all post types |
```

### Emphasis

- **Bold** (`**text**`): For important terms, UI elements, file names
- **Italic** (`*text*`): For emphasis, variable names, placeholders
- **Code** (`` `text` ``): For code, commands, file paths, technical terms
- **Avoid overuse**: Don't emphasize everything

---

## Documentation Template

Use this template when creating new documentation:

```markdown
# [Document Title]

**Date**: YYYY-MM-DD  
**Status**: Active | Draft | Deprecated  
**Last Updated**: YYYY-MM-DD

## Overview

[Brief description of what this document covers and who it's for]

## Table of Contents

- [Section 1](#section-1)
- [Section 2](#section-2)
- [See Also](#see-also)

---

## Section 1

[Content]

### Subsection

[Content with examples]

```typescript
// Example code
```

---

## Section 2

[Content]

---

## See Also

- [Related Doc 1](./related-doc-1.md) - Description
- [Related Doc 2](./related-doc-2.md) - Description

## Additional Resources

- [External Link](https://example.com) - Description
```

---

## Review Process

### Before Submitting

1. **Self-review**: Read through your documentation
2. **Check links**: Verify all links work
3. **Test examples**: Ensure code examples are correct
4. **Spell check**: Use spell checker
5. **Format check**: Follow formatting guidelines

### Review Checklist

When reviewing documentation, check:

- [ ] Clear and concise writing
- [ ] Correct grammar and spelling
- [ ] Consistent terminology
- [ ] Working code examples
- [ ] All links are valid
- [ ] Proper heading hierarchy
- [ ] "See Also" section included
- [ ] Metadata (date, status) is current
- [ ] File name follows kebab-case convention

### Update Process

1. **Update date**: Change "Last Updated" when making changes
2. **Update status**: Mark as "Draft" if incomplete
3. **Update links**: Fix broken links
4. **Add to changelog**: Note significant changes

---

## Best Practices

### Do's ✅

- **Be specific**: "Configure the `DATABASE_URL` environment variable" not "Set up the database"
- **Use examples**: Show, don't just tell
- **Link related docs**: Help readers find related information
- **Keep it current**: Update documentation when code changes
- **Use diagrams**: Visual aids help understanding (when appropriate)
- **Include troubleshooting**: Add common issues and solutions
- **Version information**: Note version requirements when relevant

### Don'ts ❌

- **Don't duplicate**: Link to existing docs instead of repeating content
- **Don't assume knowledge**: Explain concepts on first use
- **Don't use vague language**: "Sometimes" → "When X condition is met"
- **Don't skip examples**: Code examples are essential
- **Don't forget links**: Update links when moving/renaming files
- **Don't leave TODOs**: Complete documentation or mark as draft
- **Don't use jargon**: Explain technical terms

### Documentation Maintenance

- **Regular reviews**: Review docs quarterly for accuracy
- **Update on changes**: Update docs when code changes
- **Remove outdated content**: Archive or delete obsolete docs
- **Keep structure consistent**: Follow the standard structure
- **Monitor feedback**: Address user questions and issues

---

## Examples

### Good Documentation

```markdown
# Error Handling Guide

**Date**: 2025-01-15  
**Status**: Active

## Overview

This guide covers SmartFlowSocial's centralized error handling system, including error classes, error boundaries, and error logging.

## Error Classes

SmartFlowSocial uses custom error classes for different error types:

```typescript
import { ValidationError } from "~/lib/errors";

throw new ValidationError("Invalid input", { field: "email" });
```

### Available Error Classes

| Class | Status Code | Use Case |
|-------|-------------|----------|
| `ValidationError` | 400 | Invalid input data |
| `AuthenticationError` | 401 | Authentication required |
| `AuthorizationError` | 403 | Insufficient permissions |

## See Also

- [Architecture Guide](./getting-started/architecture.md) - System architecture
- [Security Guide](./security/security.md) - Security best practices
```

### Poor Documentation

```markdown
# Errors

Sometimes things go wrong. Use the error classes.

```typescript
throw new ValidationError("bad");
```

See other docs for more info.
```

---

## Resources

- [Markdown Guide](https://www.markdownguide.org/) - Markdown syntax reference
- [Technical Writing](https://developers.google.com/tech-writing) - Google's technical writing guide
- [Documentation Best Practices](https://www.writethedocs.org/guide/) - Write the Docs community guide

---

## Questions?

If you have questions about documentation standards:
1. Check this guide first
2. Review existing documentation for examples
3. Ask in the project's communication channel
4. Open an issue for discussion






