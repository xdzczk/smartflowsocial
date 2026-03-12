# Documentation Style Guide

**Last updated:** 2025-03-12

Standards and conventions for writing SmartFlowSocial documentation.

---

## Writing Standards

### Tone and Voice

- **Clear and Concise** - Use simple, direct language
- **Professional but Friendly** - Approachable but authoritative
- **Active Voice** - Prefer active over passive
- **Second Person** - Use "you" when addressing the reader

### Language

- **US English** - Use US spelling (e.g., "color" not "colour")
- **Consistent Terminology** - Use the same terms throughout
- **Avoid Jargon** - Explain technical terms on first use
- **Plain Language** - Avoid unnecessary complexity

---

## Document Structure

### Standard Sections

Every documentation file should include:

1. **Title** - Clear, descriptive title
2. **Metadata** - Date, status, difficulty, time estimate
3. **Table of Contents** - For documents > 200 lines
4. **Overview/Introduction** - What this document covers
5. **Main Content** - Organized into logical sections
6. **Examples** - Code examples and use cases
7. **Related Documentation** - Links to related docs
8. **Next Steps** - What to read next

### Metadata Format

```markdown
**Estimated time:** X minutes  
**Difficulty:** Beginner | Intermediate | Advanced  
**Last updated:** YYYY-MM-DD
```

---

## Formatting Guidelines

### File Naming

- **Use kebab-case:** `lowercase-with-hyphens.md`
- **Be descriptive:** `error-handling.md` not `errors.md`
- **Use hyphens:** `test-strategy.md` not `test_strategy.md`

### Headings

```markdown
# Title (H1) - Document title only

## Major Section (H2) - Main sections

### Subsection (H3) - Subsections

#### Detail (H4) - Detailed topics
```

**Guidelines:**

- Only one H1 per document
- Use H2 for major sections
- Don't skip heading levels

### Code Blocks

````markdown
✅ Good:

```typescript
// app/features/user/... (data or services)
export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
```
````

❌ Bad:

```
getUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}
```

````

**Requirements:**
- Specify language for syntax highlighting
- Include file paths when relevant
- Add comments for non-obvious code
- Keep examples working and complete

### Links

- **Use relative paths:** `./installation.md` or `../guides/deployment.md`
- **Descriptive link text:** `[Installation Guide](./installation.md)`
- **Update links:** When moving files, update all references

### Lists

- **Use consistent markers:** Use `-` for unordered lists
- **Parallel structure:** Keep list items grammatically parallel
- **Nested lists:** Use 2 spaces for indentation

### Tables

- **Use for structured data:** Comparisons, specifications, status
- **Include headers:** Always include header row
- **Align columns:** Use alignment for readability

---

## Code Examples

### Requirements

- ✅ **Working Examples** - All code should be functional
- ✅ **Complete Examples** - Include necessary imports and setup
- ✅ **Comments** - Add comments to explain non-obvious parts
- ✅ **Syntax Highlighting** - Use appropriate language tags
- ✅ **Context** - Show where code belongs

### Example Format

```typescript
// app/routes/dashboard.posts.tsx
import { json } from "@remix-run/node";
import { getUserById } from "~/features/user";

export async function loader({ request }: LoaderFunctionArgs) {
  // Fetch user from database
  const user = await getUserById(userId);
  return json({ user });
}
````

---

## Best Practices

### Do's ✅

- **Be specific:** "Configure the `DATABASE_URL` environment variable"
- **Use examples:** Show, don't just tell
- **Link related docs:** Help readers find related information
- **Keep it current:** Update documentation when code changes
- **Use diagrams:** Visual aids help understanding
- **Include troubleshooting:** Add common issues and solutions
- **Version information:** Note version requirements when relevant

### Don'ts ❌

- **Don't duplicate:** Link to existing docs instead of repeating
- **Don't assume knowledge:** Explain concepts on first use
- **Don't use vague language:** "Sometimes" → "When X condition is met"
- **Don't skip examples:** Code examples are essential
- **Don't forget links:** Update links when moving/renaming files
- **Don't leave TODOs:** Complete documentation or mark as draft
- **Don't use jargon:** Explain technical terms

---

## Documentation Template

````markdown
# [Document Title]

**Estimated time:** X minutes  
**Difficulty:** Beginner | Intermediate | Advanced  
**Last updated:** YYYY-MM-DD

[Brief description of what this document covers and who it's for]

## Table of Contents

- [Section 1](#section-1)
- [Section 2](#section-2)
- [Related Documentation](#related-documentation)

---

## Section 1

[Content]

### Subsection

[Content with examples]

```typescript
// Example code
```
````

---

## Section 2

[Content]

---

## Related Documentation

- [Related Doc 1](./related-doc-1.md) - Description
- [Related Doc 2](./related-doc-2.md) - Description

---

**Next:** [Next Guide](./next-guide.md) → Description

```

---

## Review Process

### Before Submitting

1. **Self-review:** Read through your documentation
2. **Check links:** Verify all links work
3. **Test examples:** Ensure code examples are correct
4. **Spell check:** Use spell checker
5. **Format check:** Follow formatting guidelines

### Review Checklist

- [ ] Clear and concise writing
- [ ] Correct grammar and spelling
- [ ] Consistent terminology
- [ ] Working code examples
- [ ] All links are valid
- [ ] Proper heading hierarchy
- [ ] "Related Documentation" section included
- [ ] Metadata (date, status) is current
- [ ] File name follows kebab-case convention

---

## Resources

- [Markdown Guide](https://www.markdownguide.org/) - Markdown syntax reference
- [Technical Writing](https://developers.google.com/tech-writing) - Google's technical writing guide
- [Documentation Best Practices](https://www.writethedocs.org/guide/) - Write the Docs community guide

---

**Next:** [Contributing to Documentation](./contributing.md) → How to contribute

```
