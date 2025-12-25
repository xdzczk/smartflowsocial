# Security Testing Guide

**Date**: 2025-12-25  
**Status**: ✅ Implemented

## Overview

Security testing ensures that SmartFlowSocial is protected against common security vulnerabilities. We test for:

- **XSS (Cross-Site Scripting)** - Malicious scripts injected into web pages
- **SQL Injection** - Malicious SQL code injected into database queries
- **CSRF (Cross-Site Request Forgery)** - Unauthorized actions performed on behalf of users
- **Authentication/Authorization** - Proper access control
- **Input Validation** - Proper validation and sanitization of user input
- **File Upload Security** - Secure handling of file uploads
- **Security Headers** - Proper HTTP security headers

## Quick Start

### Run Security Tests

```bash
# Run all security tests
npm run test:security

# Run specific security test file
npm run test tests/security/xss-prevention.test.ts
```

## Test Coverage

### 1. XSS Prevention Tests

Located in `tests/security/xss-prevention.test.ts`, these tests verify that user input is properly sanitized:

- ✅ Script tag removal
- ✅ Inline event handler removal
- ✅ Dangerous protocol removal (javascript:, data:, vbscript:)
- ✅ Iframe, embed, object tag removal
- ✅ Form tag removal
- ✅ Style tag removal
- ✅ HTML entity escaping
- ✅ Safe HTML tag preservation

**Key Functions Tested:**
- `sanitizeMarkdown()` - Markdown sanitization

### 2. SQL Injection Prevention Tests

Located in `tests/security/sql-injection.test.ts`, these tests verify that Prisma uses parameterized queries:

- ✅ Parameterized query usage
- ✅ SQL injection attempt handling
- ✅ Special character handling
- ✅ Query structure validation

**Key Functions Tested:**
- `getUserById()` - User lookup
- `getPostById()` - Post lookup

### 3. Authentication & Authorization Tests

Located in `tests/security/authentication.test.ts`, these tests verify proper authentication:

- ✅ Session management
- ✅ Authentication checks
- ✅ Authorization checks
- ✅ Session cookie security (httpOnly, secure, sameSite)

**Key Functions Tested:**
- `getUserId()` - Get user ID from session
- `requireUserId()` - Require authenticated user
- `getUser()` - Get user from session

### 4. CSRF Protection Tests

Located in `tests/security/csrf-protection.test.ts`, these tests verify CSRF protection:

- ✅ Remix's built-in CSRF protection
- ✅ SameSite cookie usage
- ✅ Request origin validation
- ✅ POST method for state-changing operations

### 5. Input Validation Tests

Located in `tests/security/input-validation.test.ts`, these tests verify input validation:

- ✅ Required field validation
- ✅ Field type validation
- ✅ Field format validation
- ✅ String length limits
- ✅ Array input validation
- ✅ File upload validation
- ✅ URL validation

### 6. File Upload Security Tests

Located in `tests/security/file-upload-security.test.ts`, these tests verify file upload security:

- ✅ File type validation (MIME types, extensions)
- ✅ File content validation
- ✅ File size limits
- ✅ File storage security
- ✅ Path traversal prevention
- ✅ Image validation

### 7. Security Headers Tests

Located in `tests/security/security-headers.test.ts`, these tests document security headers:

- ✅ Content-Security-Policy
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Strict-Transport-Security
- ✅ Referrer-Policy
- ✅ Permissions-Policy

## Security Best Practices

### 1. Input Sanitization

Always sanitize user input before:
- Displaying in HTML
- Storing in database
- Using in database queries
- Including in URLs

**Example:**
```typescript
import { sanitizeMarkdown } from "~/lib/markdown-sanitizer.server";

const sanitized = sanitizeMarkdown(userInput);
```

### 2. Parameterized Queries

Always use parameterized queries (Prisma does this automatically):

**✅ Safe:**
```typescript
const user = await prisma.user.findUnique({ where: { id: userId } });
```

**❌ Vulnerable:**
```typescript
// Never use raw SQL with string concatenation
const user = await prisma.$queryRaw(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 3. Authentication & Authorization

Always verify:
- User is authenticated
- User owns the resource OR has admin permissions
- Operation is allowed for the user's role

**Example:**
```typescript
import { requireUserId } from "~/features/auth/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  // ... rest of loader
}
```

### 4. File Uploads

Always validate:
- File type (MIME type, not just extension)
- File size
- File content (magic bytes)
- File name (sanitize, prevent path traversal)

**Example:**
```typescript
const allowedTypes = ["image/jpeg", "image/png"];
const maxSize = 10 * 1024 * 1024; // 10MB

if (!allowedTypes.includes(file.type)) {
  throw new ValidationError("Invalid file type");
}

if (file.size > maxSize) {
  throw new ValidationError("File too large");
}
```

### 5. Security Headers

Set appropriate security headers in your server configuration:

```typescript
// Example security headers
{
  "Content-Security-Policy": "default-src 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

## Common Vulnerabilities

### XSS (Cross-Site Scripting)

**Prevention:**
- Sanitize all user input
- Use Content-Security-Policy
- Escape HTML entities
- Use React's built-in XSS protection

**Example:**
```typescript
// Vulnerable
<div>{userInput}</div>

// Safe
<div>{sanitizeMarkdown(userInput)}</div>
```

### SQL Injection

**Prevention:**
- Use parameterized queries (Prisma)
- Never concatenate user input into SQL
- Validate input types

**Example:**
```typescript
// Vulnerable (if using raw SQL)
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// Safe (Prisma)
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### CSRF (Cross-Site Request Forgery)

**Prevention:**
- Use Remix's built-in CSRF protection
- Use SameSite cookies
- Validate request origin
- Use POST for state-changing operations

### File Upload Attacks

**Prevention:**
- Validate file types (MIME, not just extension)
- Enforce file size limits
- Store files outside web root
- Use unique file names
- Sanitize file names

## CI/CD Integration

Security tests can be integrated into CI/CD:

```yaml
# .github/workflows/security.yml
- name: Run Security Tests
  run: npm run test:security
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Remix Security](https://remix.run/docs/en/main/guides/security)

