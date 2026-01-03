# Security Testing

This directory contains security tests to ensure the application is protected against common security vulnerabilities.

## Overview

Security testing ensures that the application is protected against:

- **XSS (Cross-Site Scripting)** - Malicious scripts injected into web pages
- **SQL Injection** - Malicious SQL code injected into database queries
- **CSRF (Cross-Site Request Forgery)** - Unauthorized actions performed on behalf of users
- **Authentication/Authorization** - Proper access control
- **Input Validation** - Proper validation and sanitization of user input
- **File Upload Security** - Secure handling of file uploads
- **Security Headers** - Proper HTTP security headers

## Test Files

### XSS Prevention Tests (`xss-prevention.test.ts`)

Tests that the application properly sanitizes user input to prevent XSS attacks:

- Script tag removal
- Inline event handler removal
- Dangerous protocol removal (javascript:, data:, vbscript:)
- Iframe, embed, object tag removal
- Form tag removal
- Style tag removal
- HTML entity escaping
- Safe HTML tag preservation

### SQL Injection Prevention Tests (`sql-injection.test.ts`)

Tests that the application uses parameterized queries (via Prisma) to prevent SQL injection:

- Parameterized query usage
- SQL injection attempt handling
- Special character handling
- Query structure validation

### Authentication Tests (`authentication.test.ts`)

Tests that the application properly authenticates and authorizes users:

- Session management
- Authentication checks
- Authorization checks
- Session cookie security (httpOnly, secure, sameSite)

### CSRF Protection Tests (`csrf-protection.test.ts`)

Tests that the application protects against CSRF attacks:

- Remix's built-in CSRF protection
- SameSite cookie usage
- Request origin validation
- POST method for state-changing operations

### Input Validation Tests (`input-validation.test.ts`)

Tests that the application properly validates and sanitizes user input:

- Required field validation
- Field type validation
- Field format validation
- String length limits
- Array input validation
- File upload validation
- URL validation

### File Upload Security Tests (`file-upload-security.test.ts`)

Tests that file uploads are properly validated and secured:

- File type validation (MIME types, extensions)
- File content validation
- File size limits
- File storage security
- Path traversal prevention
- Image validation

### Security Headers Tests (`security-headers.test.ts`)

Tests that the application sets appropriate security headers:

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy

## Running Tests

```bash
# Run all security tests
npm run test:security

# Run specific security test file
npm run test tests/security/xss-prevention.test.ts
```

## Security Best Practices

### 1. Input Sanitization

Always sanitize user input before:

- Displaying in HTML
- Storing in database
- Using in database queries
- Including in URLs

### 2. Parameterized Queries

Always use parameterized queries (Prisma does this automatically):

- ✅ `prisma.user.findUnique({ where: { id: userId } })`
- ❌ `prisma.$queryRaw(\`SELECT \* FROM users WHERE id = '${userId}'\`)`

### 3. Authentication & Authorization

Always verify:

- User is authenticated
- User owns the resource OR has admin permissions
- Operation is allowed for the user's role

### 4. File Uploads

Always validate:

- File type (MIME type, not just extension)
- File size
- File content (magic bytes)
- File name (sanitize, prevent path traversal)

### 5. Security Headers

Set appropriate security headers:

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (production only)

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

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Remix Security](https://remix.run/docs/en/main/guides/security)


