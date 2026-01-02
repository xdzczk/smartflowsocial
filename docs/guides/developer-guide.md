# Developer Guide

**Estimated time:** 60 minutes  
**Difficulty:** Intermediate  
**Last updated:** 2026-01-02

Complete guide for developers working on SmartFlowSocial, covering development workflow, architecture patterns, and best practices.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Architecture Patterns](#architecture-patterns)
- [Code Organization](#code-organization)
- [Testing](#testing)
- [Debugging](#debugging)
- [Performance](#performance)
- [Best Practices](#best-practices)

---

## Getting Started

### Prerequisites

- Node.js 20.0.0+
- pnpm package manager
- PostgreSQL 14+
- Redis 6+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial

# Install dependencies
pnpm install

# Set up environment
cp example.env .env
# Edit .env with your configuration

# Set up database
pnpm exec prisma generate
pnpm exec prisma db push

# Start development server
pnpm dev
```

See [Installation Guide](../getting-started/installation.md) for detailed setup.

---

## Development Workflow

### Daily Workflow

1. **Pull latest changes:**
```bash
git pull origin main
```

2. **Create feature branch:**
```bash
git checkout -b feature/your-feature-name
```

3. **Make changes:**
- Write code following [coding standards](#code-organization)
- Write tests for new functionality
- Update documentation if needed

4. **Test locally:**
```bash
# Run linter
pnpm lint

# Run type check
pnpm exec tsc --noEmit

# Run tests
pnpm test

# Start dev server
pnpm dev
```

5. **Commit changes:**
```bash
git add .
git commit -m "feat: add your feature"
```

6. **Push and create PR:**
```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

### Code Review Process

1. **Self-review:**
   - Review your own code
   - Run all tests
   - Check for linting errors
   - Verify functionality

2. **Request review:**
   - Assign reviewers
   - Add description
   - Link related issues

3. **Address feedback:**
   - Make requested changes
   - Update PR
   - Respond to comments

---

## Architecture Patterns

### Feature-Based Organization

Code is organized by features, not technical layers:

```
app/features/
├── posts/              # Post management feature
│   ├── components/     # Feature-specific components
│   ├── services/       # Business logic
│   ├── types.ts        # Feature types
│   └── index.ts        # Public API
├── auth/               # Authentication feature
├── payments/           # Payment processing
└── ...
```

**Benefits:**
- Easy to locate feature code
- Clear feature boundaries
- Simplified refactoring
- Better code organization

### Layer Boundaries

#### Models (`app/models/*`)
- **Purpose:** Database access layer
- **Contains:** Prisma queries, CRUD operations
- **Does NOT contain:** Business logic, permissions, workflows

#### Features (`app/features/*`)
- **Purpose:** Business logic layer
- **Contains:** Workflows, permissions, plan enforcement
- **Does NOT contain:** Direct Prisma queries, HTTP handling

#### Routes (`app/routes/*`)
- **Purpose:** HTTP wiring layer
- **Contains:** Request parsing, response formatting, UI composition
- **Does NOT contain:** Business logic, database queries

See [Architecture Overview](../getting-started/architecture.md) for details.

---

## Code Organization

### File Naming

- **Routes:** `lowercase.with.dots.tsx` (e.g., `dashboard.settings.tsx`)
- **Components:** `PascalCase.tsx` (e.g., `PostCard.tsx`)
- **Utilities:** `camelCase.ts` (e.g., `helpers.ts`)
- **Server-only:** `.server.ts` suffix (e.g., `user.server.ts`)

### Import Organization

```typescript
// 1. External dependencies
import { json } from "@remix-run/node";
import { useState } from "react";

// 2. Internal features (public API)
import { getUserById } from "~/features/user";
import { requireUserId } from "~/features/auth";

// 3. Internal utilities
import { formatDate } from "~/lib/helpers";

// 4. Types
import type { LoaderFunctionArgs } from "@remix-run/node";
```

### Feature Public APIs

Always import from feature public APIs, not internals:

```typescript
// ✅ Good: Use public API
import { getUser, requireUserId } from "~/features/auth";
import { getScheduledPosts } from "~/features/posts";

// ❌ Bad: Deep import from internals
import { getUser } from "~/features/auth/session.server";
import { getScheduledPosts } from "~/features/posts/services/dashboard-loader.server";
```

---

## Testing

### Test Types

1. **Unit Tests** - Pure functions, utilities
2. **Integration Tests** - Loaders, actions, API routes
3. **E2E Tests** - Full user flows (Cypress)
4. **Property-Based Tests** - Random input generation
5. **Security Tests** - XSS, SQL injection, etc.
6. **Performance Tests** - Function benchmarks

### Writing Tests

```typescript
// tests/unit/helpers.test.ts
import { describe, it, expect } from "vitest";
import { formatDate } from "~/lib/helpers";

describe("formatDate", () => {
  it("should format date correctly", () => {
    const date = new Date("2026-01-02");
    expect(formatDate(date)).toBe("01/02/2026");
  });
});
```

See [Testing Guide](./testing.md) for complete testing documentation.

---

## Debugging

### Development Tools

1. **Browser DevTools:**
   - React DevTools
   - Network tab
   - Console logs

2. **Node.js Inspector:**
```bash
node --inspect server.ts
# Open chrome://inspect in Chrome
```

3. **Prisma Studio:**
```bash
pnpm exec prisma studio
# Opens at http://localhost:5555
```

4. **Redis CLI:**
```bash
redis-cli -u $REDIS_URL
# Monitor queue: KEYS bull:*
```

### Common Debugging Steps

1. **Check logs:**
   - Application logs
   - Worker logs
   - Database logs

2. **Verify environment:**
   - Check `.env` variables
   - Test database connection
   - Test Redis connection

3. **Review code:**
   - Check error messages
   - Review stack traces
   - Verify data flow

4. **Test manually:**
   - Test in browser
   - Test API endpoints
   - Test database queries

---

## Performance

### Database Optimization

1. **Use indexes:**
```prisma
model Post {
  userId String
  scheduledAt DateTime?
  
  @@index([userId])
  @@index([scheduledAt])
}
```

2. **Limit result sets:**
```typescript
// ✅ Good: Pagination
const posts = await prisma.post.findMany({
  where: { userId },
  take: 20,
  skip: 0,
});

// ❌ Bad: Fetch all
const posts = await prisma.post.findMany({ where: { userId } });
```

3. **Select specific fields:**
```typescript
// ✅ Good: Select only needed fields
const posts = await prisma.post.findMany({
  select: { id: true, content: true },
});

// ❌ Bad: Fetch all fields
const posts = await prisma.post.findMany();
```

### Caching

1. **HTTP caching:**
```typescript
return json(data, {
  headers: {
    "Cache-Control": "public, max-age=3600",
  },
});
```

2. **Application-level caching:**
```typescript
// Cache expensive operations
const cacheKey = `user:${userId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
```

---

## Best Practices

### Code Quality

1. **Type Safety:**
   - Use TypeScript throughout
   - Avoid `any` types
   - Use type guards

2. **Error Handling:**
   - Use custom error classes
   - Handle errors gracefully
   - Log errors appropriately

3. **Code Style:**
   - Follow ESLint rules
   - Use Prettier for formatting
   - Write self-documenting code

### Security

1. **Input Validation:**
   - Validate all user input
   - Sanitize data
   - Use parameterized queries

2. **Authentication:**
   - Always check authentication
   - Verify permissions
   - Use secure session management

3. **Secrets:**
   - Never commit secrets
   - Use environment variables
   - Rotate secrets regularly

### Documentation

1. **Code Comments:**
   - Explain why, not what
   - Document complex logic
   - Keep comments current

2. **Type Definitions:**
   - Use descriptive types
   - Document interfaces
   - Export public types

3. **README Files:**
   - Document features
   - Include examples
   - Keep up to date

---

## Related Documentation

- [Architecture Overview](../getting-started/architecture.md) - System design
- [Testing Guide](./testing.md) - Testing strategies
- [Contributing Guide](../CONTRIBUTING.md) - Contribution guidelines
- [Configuration Reference](../reference/configuration.md) - Configuration options
- [API Development Guide](./api-development.md) - Building API endpoints

---

**Next:** [API Development Guide](./api-development.md) → Learn to build API endpoints

