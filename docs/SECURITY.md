# Security Best Practices

This guide covers security best practices for deploying and operating SmartFlowSocial.

## Table of Contents

- [Overview](#overview)
- [Secret Management](#secret-management)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation](#input-validation)
- [SQL Injection Prevention](#sql-injection-prevention)
- [XSS Protection](#xss-protection)
- [CSRF Protection](#csrf-protection)
- [Rate Limiting](#rate-limiting)
- [HTTPS/TLS](#httpstls)
- [Security Headers](#security-headers)
- [Dependency Security](#dependency-security)
- [Database Security](#database-security)
- [API Security](#api-security)
- [Security Audit Checklist](#security-audit-checklist)

---

## Overview

SmartFlowSocial handles sensitive data including:
- User authentication (Nostr keys)
- Payment information (Lightning invoices)
- User content and posts
- Database credentials
- API keys

This guide provides security best practices for protecting this data.

---

## Secret Management

### Environment Variables

**Never commit secrets to version control.**

```bash
# ✅ Good: Use .env files (gitignored)
# ❌ Bad: Hardcode secrets in code
```

### Secret Rotation

Rotate secrets regularly:

1. **Session Secret**: Every 90 days
2. **Database Passwords**: Every 180 days
3. **API Keys**: As needed
4. **Nostr Keys**: Never (unless compromised)

### Secret Storage Services

For production, use secret management services:

1. **AWS Secrets Manager**
2. **HashiCorp Vault**
3. **Azure Key Vault**
4. **Google Secret Manager**

### Generating Strong Secrets

```bash
# Session secret (32+ characters)
openssl rand -base64 32

# Database password
openssl rand -base64 24

# API keys
openssl rand -hex 32
```

---

## Authentication & Authorization

### Nostr Authentication

SmartFlowSocial uses Nostr (NIP-07) for authentication:

- ✅ Private keys never leave the user's browser
- ✅ Events signed client-side
- ✅ Server validates signatures

### Session Management

**Session Configuration:**

```typescript
// Secure session settings
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
  },
});
```

**Best Practices:**

1. ✅ Use `httpOnly` cookies (prevents XSS)
2. ✅ Use `secure` flag in production (HTTPS only)
3. ✅ Set appropriate `maxAge`
4. ✅ Use strong `SESSION_SECRET`
5. ✅ Rotate session secrets periodically

### Authorization Checks

Always verify user permissions:

```typescript
// ✅ Good: Check user ownership
const post = await getPost(postId);
if (post.userId !== user.id) {
  throw new UnauthorizedError("Not authorized");
}

// ❌ Bad: Trust client-side data
// Don't rely on client-provided user IDs
```

---

## Input Validation

### Server-Side Validation

**Always validate on the server**, never trust client input:

```typescript
// ✅ Good: Validate input
import { z } from "zod";

const postSchema = z.object({
  content: z.string().min(1).max(5000),
  scheduledFor: z.number().int().positive(),
});

const validated = postSchema.parse(formData);
```

### Sanitization

Sanitize user input to prevent XSS:

```typescript
// For markdown content
import { sanitize } from "~/lib/markdown-sanitizer.server";

const sanitized = sanitize(userContent);
```

### File Upload Validation

Validate file uploads:

```typescript
// ✅ Good: Validate file type and size
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

if (file.size > MAX_FILE_SIZE) {
  throw new ValidationError("File too large");
}

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new ValidationError("Invalid file type");
}
```

---

## SQL Injection Prevention

### Prisma ORM

SmartFlowSocial uses Prisma, which automatically prevents SQL injection:

```typescript
// ✅ Good: Prisma parameterized queries
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// ❌ Bad: Raw SQL (avoid if possible)
// If you must use raw SQL, use parameterized queries
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE id = ${userId}
`;
```

### Never Use String Concatenation

```typescript
// ❌ Bad: SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Good: Use Prisma or parameterized queries
const user = await prisma.user.findUnique({ where: { id: userId } });
```

---

## XSS Protection

### Content Security Policy (CSP)

Set CSP headers to prevent XSS:

```typescript
// In server.ts or middleware
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  next();
});
```

### Sanitize User Content

```typescript
// Sanitize before storing
const sanitized = sanitize(userContent);

// Sanitize before displaying
const safeHtml = escapeHtml(userContent);
```

### React XSS Protection

React automatically escapes content:

```tsx
// ✅ Good: React escapes automatically
<div>{userContent}</div>

// ⚠️ Dangerous: Only use if content is trusted
<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
```

---

## CSRF Protection

### Remix CSRF Protection

Remix provides built-in CSRF protection for forms:

```tsx
// ✅ Good: Use Remix Form
<Form method="post">
  <input name="content" />
  <button type="submit">Submit</button>
</Form>
```

### API Endpoints

For API endpoints, use CSRF tokens:

```typescript
// Generate CSRF token
const csrfToken = generateCSRFToken();

// Validate in action
const formToken = formData.get("csrfToken");
if (formToken !== csrfToken) {
  throw new UnauthorizedError("Invalid CSRF token");
}
```

---

## Rate Limiting

### Implement Rate Limiting

Protect against abuse:

```typescript
// Example with express-rate-limit
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

### Per-Endpoint Rate Limiting

```typescript
// Stricter limits for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 requests per 15 minutes
});

app.use("/api/publish", strictLimiter);
```

### Redis-Based Rate Limiting

For distributed systems:

```typescript
import { RateLimiterRedis } from "rate-limiter-flexible";

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl",
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
});
```

---

## HTTPS/TLS

### Always Use HTTPS in Production

**Never serve production traffic over HTTP.**

### SSL/TLS Configuration

1. **Use Strong Ciphers**
2. **Enable TLS 1.2+**
3. **Disable Weak Protocols** (SSL 3.0, TLS 1.0, TLS 1.1)
4. **Use Perfect Forward Secrecy**

### Reverse Proxy Configuration

See [Deployment Guide](./DEPLOYMENT.md) for nginx/Caddy configuration.

### Certificate Management

- Use Let's Encrypt for free certificates
- Auto-renew certificates
- Monitor certificate expiration

---

## Security Headers

### Recommended Headers

```typescript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // HSTS
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline';"
  );
  
  next();
});
```

---

## Dependency Security

### Regular Updates

Keep dependencies up to date:

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

### Automated Security Scanning

Use tools like:

1. **Dependabot** (GitHub)
2. **Snyk**
3. **npm audit**
4. **OWASP Dependency-Check**

### Lock File Security

- ✅ Commit `package-lock.json`
- ✅ Use exact versions in production
- ✅ Review dependency changes

---

## Database Security

### Connection Security

1. **Use SSL/TLS for database connections**
2. **Restrict database access** (firewall rules)
3. **Use strong passwords**
4. **Limit database user permissions**

### Connection String

```env
# ✅ Good: SSL enabled
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# ❌ Bad: No SSL
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Database User Permissions

Create dedicated database users with minimal permissions:

```sql
-- Create user with limited permissions
CREATE USER smartflow_app WITH PASSWORD 'strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smartflow_app;
```

---

## API Security

### Authentication

All API endpoints require authentication:

```typescript
// ✅ Good: Require authentication
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  // ...
}
```

### Input Validation

Validate all API inputs:

```typescript
// ✅ Good: Validate API input
const schema = z.object({
  postId: z.string().cuid(),
  content: z.string().max(5000),
});

const validated = schema.parse(requestBody);
```

### Error Messages

Don't expose internal errors:

```typescript
// ✅ Good: Generic error message
throw new Error("Operation failed");

// ❌ Bad: Expose internal details
throw new Error(`Database error: ${dbError.message}`);
```

---

## Security Audit Checklist

### Pre-Deployment

- [ ] All secrets in environment variables (not in code)
- [ ] Strong session secrets generated
- [ ] HTTPS configured
- [ ] Security headers set
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma)
- [ ] XSS protection (sanitization)
- [ ] CSRF protection enabled
- [ ] Database connections use SSL
- [ ] Dependencies updated and audited
- [ ] Error messages don't expose internals
- [ ] File upload validation
- [ ] Authentication required on all protected routes

### Regular Maintenance

- [ ] Review security logs weekly
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly
- [ ] Review access logs
- [ ] Monitor for suspicious activity
- [ ] Security audit annually

### Incident Response

- [ ] Document security incidents
- [ ] Rotate compromised secrets immediately
- [ ] Review and patch vulnerabilities
- [ ] Notify affected users (if required)
- [ ] Post-mortem analysis

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Remix Security](https://remix.run/docs/en/main/guides/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Deployment Guide](./DEPLOYMENT.md)
- [Error Handling Guide](./ERROR_HANDLING.md)

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Email security concerns to the maintainers
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

---

## Security Contact

For security-related questions or to report vulnerabilities, contact the project maintainers through the appropriate channels.




