# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow
these steps:

### 1. **Do NOT** open a public GitHub issue

- Security vulnerabilities should be reported privately to prevent exploitation

### 2. Report via email

- Send details to: **security@smartflow.social**
- Include:
  - Description of the vulnerability
  - Steps to reproduce
  - Potential impact
  - Suggested fix (if any)

### 3. Response timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Resolution**: Depends on severity and complexity

### 4. Disclosure policy

- We will work with you to resolve the issue before public disclosure
- We will credit you in the security advisory (if desired)
- We will coordinate disclosure timing with you

## Security Best Practices

When using SmartFlowSocial:

1. **Keep dependencies updated**: Run `pnpm audit` regularly
2. **Use strong secrets**: Generate strong `SESSION_SECRET` values
3. **Enable HTTPS**: Always use HTTPS in production
4. **Review permissions**: Limit database user permissions
5. **Monitor logs**: Regularly review application logs for suspicious activity

## Known Security Features

SmartFlowSocial includes the following security features:

- ✅ CSRF protection
- ✅ XSS protection
- ✅ Content Security Policy (CSP)
- ✅ Secure headers (HSTS, X-Frame-Options, etc.)
- ✅ Rate limiting
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (via Prisma)
- ✅ Secure session management

For more details, see [Security Guide](./docs/guides/security.md).

## Security Updates

Security updates are released as patch versions (e.g., 1.0.0 → 1.0.1). Always update to the latest
patch version to receive security fixes.

---

**Thank you for helping keep SmartFlowSocial secure!**

