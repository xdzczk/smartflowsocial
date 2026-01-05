# Link Verification Guide

**Last updated:** 2026-01-02

Guide for verifying and maintaining links in the documentation.

---

## Overview

All documentation links should be verified regularly to ensure:

- Internal links point to existing files
- External links are valid and accessible
- Cross-references are correct
- Anchor links work properly

---

## Internal Link Verification

### Markdown Link Format

**Relative links:**

```markdown
[Link Text](./relative/path.md)
[Link Text](../parent/path.md)
[Link Text](../../guides/user-guides/posting.md)
```

**Anchor links:**

```markdown
[Section](#section-name)
[Section in Another File](./file.md#section-name)
```

### Verification Checklist

1. **File exists:**

   - Verify target file exists
   - Check file path is correct
   - Ensure file hasn't been moved

2. **Anchor exists:**

   - Verify section heading exists
   - Check heading format matches link
   - Ensure heading hasn't changed

3. **Path is correct:**
   - Check relative path is accurate
   - Verify directory structure
   - Test from different locations

---

## External Link Verification

### Common External Links

**Nostr Resources:**

- NIPs: https://github.com/nostr-protocol/nips
- Nostr Protocol: https://nostr.com

**Technology Docs:**

- Remix: https://remix.run/docs
- Prisma: https://www.prisma.io/docs
- BullMQ: https://docs.bullmq.io

### Verification Process

1. **Check link is accessible:**

   - Test link in browser
   - Verify HTTPS/HTTP protocol
   - Check for redirects

2. **Verify content is relevant:**

   - Ensure link content matches context
   - Check link hasn't changed
   - Verify link is still maintained

3. **Update if needed:**
   - Replace broken links
   - Update outdated links
   - Remove deprecated links

---

## Automated Verification

### Script for Link Checking

```bash
#!/bin/bash
# verify-links.sh

# Find all markdown files
find docs -name "*.md" -type f | while read file; do
  echo "Checking $file..."

  # Extract links
  grep -oP '\[.*?\]\(.*?\)' "$file" | while read link; do
    # Extract URL
    url=$(echo "$link" | sed -n 's/.*(\(.*\))/\1/p')

    # Check if internal link
    if [[ "$url" == .* ]]; then
      # Check if file exists
      target_file=$(dirname "$file")/$url
      if [ ! -f "$target_file" ]; then
        echo "  ❌ Broken link: $link in $file"
      fi
    fi
  done
done
```

### Manual Verification Steps

1. **Review each documentation file:**

   - Check all internal links
   - Verify external links
   - Test anchor links

2. **Update broken links:**

   - Fix file paths
   - Update moved files
   - Replace broken external links

3. **Document changes:**
   - Note link updates
   - Track moved files
   - Update link references

---

## Common Issues

### Issue 1: Moved Files

**Problem:** File moved but links not updated

**Solution:**

1. Find all references to old path
2. Update to new path
3. Verify all links work

### Issue 2: Changed Headings

**Problem:** Section heading changed, anchor link broken

**Solution:**

1. Update heading to match link
2. Or update link to match heading
3. Verify anchor works

### Issue 3: Broken External Links

**Problem:** External site changed or removed

**Solution:**

1. Find alternative source
2. Update link to new URL
3. Or remove link if not critical

---

## Maintenance Schedule

### Regular Checks

- **Weekly:** Check new documentation for broken links
- **Monthly:** Review all external links
- **Quarterly:** Full link audit
- **Before releases:** Verify all links

### Tools

- **Markdown link checkers:** Various tools available
- **Browser extensions:** Link checkers
- **CI/CD:** Automated link checking in pipeline

---

## Best Practices

1. **Use relative paths** for internal links
2. **Test links** after moving files
3. **Update links** when restructuring
4. **Document link changes** in commit messages
5. **Verify external links** periodically

---

## Related Documentation

- [Style Guide](./style-guide.md) - Documentation standards
- [Contributing](./contributing.md) - How to contribute

---

**Note:** This guide should be updated as link verification processes improve.





