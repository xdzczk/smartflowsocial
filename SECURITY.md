# Security Policy

## Supported Versions

There is no tagged release yet. `package.json` says `1.0.0`, and an older changelog heading used
that number with the date 1 January 2024. That version was never tagged or published.

Until the first tag exists, security fixes land on the default branch. After `v1.0.0` is tagged, the
support line is `1.0.x` patch releases. There is no commitment to backport fixes onto untagged
history.

| Version                         | Supported                |
| ------------------------------- | ------------------------ |
| Default branch, until first tag | Security fixes land here |
| `1.0.x` after the first tag     | Planned patch line       |
| Anything older than that tag    | Not supported            |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow
these steps:

### 1. **Do NOT** open a public GitHub issue

- Security vulnerabilities should be reported privately to prevent exploitation

### 2. Report privately

- Message us on Nostr at `npub1ckqlguq0htvs3smwy8pl5uwmfas0h208p7p8hs92ghaurgkmzzrsw3vlh0`, or open
  a
  [private GitHub security advisory](https://github.com/xdzczk/smartflowsocial/security/advisories/new)
- Include:
  - Description of the vulnerability
  - Steps to reproduce
  - Potential impact
  - Suggested fix (if any)

### 3. Response timeline

This is a single-maintainer public-domain project. There is no paid support desk and no guaranteed
clock.

- **Initial response**: best effort, usually within a few days
- **Status update**: when there is something new to say
- **Resolution**: depends on severity, and on whether a fix can ship without a history rewrite or a
  production change that needs the owner's approval

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

Security updates will be patch versions once a release exists (for example `1.0.0` to `1.0.1`).
Until then, track the default branch.

Operator checklist: [Production security checklist](./docs/guides/production-security-checklist.md).

Dependency decisions: [Dependency advisories](./docs/security/dependency-advisories.md).

---

**Thank you for helping keep SmartFlowSocial secure!**
