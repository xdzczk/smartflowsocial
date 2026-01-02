# Contributing to SmartFlowSocial

Thank you for your interest in contributing to **SmartFlowSocial**! This document provides guidelines for how team members can contribute to the project, from setting up the development environment to submitting pull requests. Following these guidelines helps us maintain a clean, efficient, and organized codebase.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Setup](#project-setup)
- [Coding Standards](#coding-standards)
- [Branching Strategy](#branching-strategy)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting and Feature Requests](#issue-reporting-and-feature-requests)
- [Code of Conduct](#code-of-conduct)

---

## Getting Started

1. **Fork the Repository**: If you haven't already, create a personal fork of the SmartFlowSocial repository.
2. **Clone Your Fork**: Clone your forked repository to your local machine.
   ```bash
   git clone https://github.com/xdzczk/SmartFlowSocial
   cd smartflowsocial
   ```
3. **Set Up the Upstream Remote**: Add the original repository as an upstream remote to stay updated.
   ```bash
   git remote add upstream https://github.com/xdzczk/SmartFlowSocial
   ```

---

## Project Setup

SmartFlowSocial is built with **Remix**, a full-stack web framework. Follow these steps to set up the development environment:

### Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **pnpm**: Install with `pnpm install -g pnpm`
- **PostgreSQL**: Database server (local or remote)
- **Git**: For version control

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp example.env .env
```

Edit `.env` with your configuration:

```dotenv
DATABASE_URL=your_database_connection_string
SESSION_SECRET=your_random_session_secret
NOSTR_PUBLISHER_URL=https://your-publisher-instance.com
PRIMAL_CACHING_URL=https://your-primal-caching-instance.com # optional
STORAGE_ACCESS_KEY=your_s3_key
STORAGE_SECRET=your_s3_secret
STORAGE_REGION=your_region
STORAGE_BUCKET=your_s3_bucket
```

### 3. Set Up the Database

```bash
# Generate Prisma client
pnpm exec prisma generate

# Run database push command
pnpm exec prisma db push

```

### 4. Start Development Server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 5. Using Docker (Optional)

For a quick setup with PostgreSQL:

```bash
pnpm docker
```

This starts a PostgreSQL container using the provided `docker-compose.yml`.

---

## Coding Standards

To ensure a consistent and maintainable codebase, please follow these coding standards:

### 1. **TypeScript & JavaScript**

- Use **TypeScript** for new code when possible
- Follow strict TypeScript configuration
- Use proper type annotations and interfaces
- Leverage TypeScript's strict mode features

### 2. **Code Style**

- Use **ESLint** and **Prettier** for code formatting
- Run `pnpm lint` to check for issues
- Run `pnpm format` to auto-format code
- Follow the existing code style patterns

### 3. **Naming Conventions**

- **Variables**: camelCase
- **Classes**: PascalCase
- **Constants**: UPPER_CASE
- **Files**: kebab-case for routes, PascalCase for components
- **Database**: snake_case (handled by Prisma)

### 4. **File Structure**

- **Routes**: `app/routes/` - Follow Remix file-based routing
- **Components**: `app/components/` - Reusable UI components
- **Models**: `app/models/` - Database models and server logic
- **Utils**: `app/utils/` - Utility functions and helpers
- **Styles**: `app/tailwind.css` - Global styles

### 4.1. **Architecture Boundaries**

To maintain clear separation of concerns, follow these strict boundaries:

#### **`app/models/*` - Database Access Layer**

- **Purpose**: Pure database access and persistence primitives
- **What belongs here**:
  - Prisma queries (CRUD operations)
  - Database transactions
  - Raw SQL queries (if needed)
  - Data access patterns (find, create, update, delete)
- **What does NOT belong here**:
  - Business logic or workflows
  - Permission checks or authorization
  - Plan enforcement or subscription validation
  - Scheduling decisions or business rules
  - Complex calculations or statistics (unless purely data aggregation)

**Example**:

```typescript
// ✅ Good: Pure data access
async function createPost(data: CreatePostData) {
  return prisma.post.create({ data });
}

// ❌ Bad: Business logic in model
async function createPostWithLogic(data: CreatePostData) {
  if (user.subscription.status !== "active") {
    throw new Error("Subscription required");
  }
  // ... business logic
}
```

#### **`app/features/*` - Business Logic Layer**

- **Purpose**: Business workflows, policies, and feature-specific logic
- **What belongs here**:
  - Business workflows and orchestration
  - Permission checks and authorization
  - Plan enforcement and subscription validation
  - Scheduling decisions and business rules
  - Feature-specific services and handlers
  - Complex calculations and business logic
- **What does NOT belong here**:
  - Direct Prisma queries (use models instead)
  - Database schema definitions
  - Raw database operations

**Example**:

```typescript
// ✅ Good: Business logic in features
async function schedulePost(userId: string, postData: PostData) {
  await requireFeatureAccess(userId, "scheduling");
  const user = await getUserById(userId);
  if (!user.subscription) {
    throw new AuthorizationError("Subscription required");
  }
  return createPost({ ...postData, userId });
}

// ❌ Bad: Direct database access in features
async function schedulePostDirect(userId: string, postData: PostData) {
  return prisma.post.create({ data: { ...postData, userId } });
}
```

#### **`app/routes/*` - HTTP Wiring Layer**

- **Purpose**: HTTP request/response handling and UI composition
- **What belongs here**:
  - Request parsing (formData, params, searchParams)
  - Response formatting (json, redirect, etc.)
  - UI component composition
  - Minimal orchestration (calling feature services)
- **What does NOT belong here**:
  - Business logic (delegate to features)
  - Database queries (delegate to models via feature services)
  - Direct model imports (use feature service layers instead)
  - Complex calculations
  - Permission logic (delegate to features)

**Example**:

```typescript
// ✅ Good: HTTP wiring with service layer
async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const queueType = params.queueType || "all";

  // Use service layer function from features
  return loadCalendarData(userId, queueType);
}

async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  // Use service layer function from features
  return handleCalendarAction(formData, userId);
}

// ❌ Bad: Direct model imports in routes
async function badLoader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // ❌ Don't import models directly
  const posts = await getScheduledPosts({ userId }); // BAD
  const user = await getUserById(userId); // BAD

  return json({ posts, user });
}

// ❌ Bad: Business logic in routes
async function badAction({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user.subscription) {
    return json({ error: "Subscription required" }, { status: 403 });
  }
  // ... business logic
}
```

**Service Layer Pattern**:

- Routes should call service layer functions from `app/features/*/services/*.server.ts`
- Service layers handle orchestration, business logic, and model calls
- This keeps routes thin and testable
- Example service layers:
  - `loadCalendarData()` - Loads calendar data
  - `handleCalendarAction()` - Handles calendar actions
  - `calculateQueueScheduleTime()` - Calculates schedule times

#### **Summary Table**

| Directory        | Purpose         | Contains                                             | Does NOT Contain                       |
| ---------------- | --------------- | ---------------------------------------------------- | -------------------------------------- |
| `app/models/*`   | Database access | Prisma queries, transactions, data access            | Business logic, permissions, workflows |
| `app/features/*` | Business logic  | Workflows, permissions, plan enforcement, scheduling | Direct Prisma queries, HTTP handling   |
| `app/routes/*`   | HTTP wiring     | Request parsing, response formatting, UI composition | Business logic, database queries       |

**When in doubt**: Ask yourself "Is this about data access, business rules, or HTTP handling?" and place it accordingly.

### 4.2. **Feature Public APIs**

To maintain clear boundaries and prevent tight coupling, all features expose a **public API** via `index.ts` files. This enforces encapsulation and makes refactoring safer.

#### **Using Feature Public APIs**

**✅ DO**: Import from feature public API

```typescript
// ✅ Good: Use public API
import { getUser, requireUserId } from "~/features/auth";
import { getUserPlanType, hasFeatureAccess } from "~/features/payments";
import {
  getScheduledDashboardData,
  calculateNextScheduleTime,
} from "~/features/posts";
```

**❌ DON'T**: Import from feature internals

```typescript
// ❌ Bad: Deep import from feature internals
import { getUser } from "~/features/auth/session.server";
import { getUserPlanType } from "~/features/payments/types";
import { getScheduledDashboardData } from "~/features/posts/services/dashboard-loader.server";
```

#### **Why Public APIs?**

1. **Encapsulation**: Internal implementation can change without breaking consumers
2. **Clear Boundaries**: Makes dependencies explicit and visible
3. **Refactoring Safety**: Can refactor internals without affecting other features
4. **Documentation**: Public API serves as documentation of what's available
5. **Testing**: Easier to mock and test when using public APIs

#### **ESLint Enforcement**

ESLint rules automatically enforce these boundaries:

- **Routes** cannot import from `~/models/*` directly (must use service layers)
- **Routes** cannot import from feature internals (services/, hooks/, components/, utils/)
- **Features** cannot import from other features' internals
- **Models** cannot import from feature internals

If you see an ESLint error about restricted imports, use the feature's public API or service layers instead.

**Example ESLint Errors:**

```
Routes cannot import from ~/models/* directly. Use feature service layers instead (e.g., ~/features/*/services/*.server.ts)
```

**Fix**: Change `import { getUserById } from "~/models/user.server"` to `import { loadUserData } from "~/features/user/services/user-profile.server"`

```
Routes must use feature public API (index.ts), not internal services
```

**Fix**: Change `import { ... } from "~/features/posts/services/..."` to `import { ... } from "~/features/posts"`

#### **Available Feature Public APIs**

All features have `index.ts` files that export their public API:

- `~/features/posts` - Post scheduling, management, and operations
- `~/features/payments` - Subscription management and plan features
- `~/features/auth` - Authentication and session management
- `~/features/user` - User profile and settings
- `~/features/engagement` - Engagement data and notifications
- `~/features/settings` - User settings management
- `~/features/templates` - Post templates
- `~/features/giveaway` - Giveaway management
- `~/features/search` - Search functionality
- `~/features/upload` - File upload operations
- `~/features/assets` - Asset management
- `~/features/cache` - Cache operations
- `~/features/nostr` - Nostr types and utilities

**See each feature's `index.ts` file for available exports.**

### 5. **Comments & Documentation**

- Write clear, concise comments for complex logic
- Use JSDoc-style comments for functions and methods
- Document API endpoints and database schema changes
- Update README.md for significant changes

---

## Branching Strategy

We follow a structured branching model to ensure a smooth workflow:

1. **`main`**: Production-ready code. Only merge into `main` when a feature or release is fully tested and approved.
2. **`development`**: Integrate all ongoing work here before merging to `main`.
3. **Feature Branches**: Create a new branch for each feature, bug fix, or enhancement.
   - Naming convention: `feature/feature-name`, `bugfix/bug-description`, or `enhancement/description`.
   ```bash
   git checkout -b feature/scheduled-posting
   ```

---

## Commit Message Guidelines

Write clear, concise, and descriptive commit messages to make it easier for others to understand your changes. Use the following format:

### Format

```
type: Short description of the change
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code formatting (no code change)
- **refactor**: Code restructuring
- **test**: Adding or updating tests
- **chore**: Miscellaneous tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes

### Examples

```
feat: add scheduled posting feature
fix: correct bulk image upload error
docs: update README with installation instructions
refactor: improve database query performance
test: add unit tests for user authentication
```

---

## Pull Request Process

Before submitting a pull request (PR), make sure your code follows all standards and has been tested.

### 1. **Sync with Upstream**

Before starting a PR, make sure your branch is up-to-date:

```bash
git checkout development
git pull upstream development
```

### 2. **Create a Pull Request**

- Push your feature branch to your forked repository
- Open a PR from your branch into `development`
- Fill out the PR template, linking relevant issues and describing changes
- Include screenshots for UI changes

### 3. **Review Process**

- Assign the PR to a reviewer (e.g., Ray or the project founder)
- Address any requested changes promptly and update the PR
- Ensure all CI checks pass

### 4. **Merge**

Once approved, your PR will be merged into `development`. The team may periodically merge `development` into `main` for production releases.

---

## Issue Reporting and Feature Requests

To report bugs or suggest new features:

### 1. **Report Bugs**

- Open an issue and use the **Bug** template
- Include clear steps to reproduce, expected vs. actual behavior
- Add screenshots or error logs if applicable
- Specify your environment (OS, Node.js version, etc.)

### 2. **Feature Requests**

- Open an issue using the **Feature Request** template
- Describe the feature, its purpose, and any relevant details
- Consider the impact on existing functionality
- Suggest implementation approach if possible

### 3. **Issue Labels**

Use appropriate labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed

---

## Development Workflow

### Setting Up Development Environment

1. **Clone and Install:**

   ```bash
   git clone https://github.com/xdzczk/SmartFlowSocial.git
   cd SmartFlowSocial
   pnpm install
   ```

2. **Configure Environment:**

   ```bash
   cp example.env .env
   # Edit .env with your local configuration
   ```

3. **Start Services:**

   ```bash
   # Start PostgreSQL and Redis with Docker
   pnpm docker

   # Or use existing services
   # Set DATABASE_URL and REDIS_URL in .env
   ```

4. **Setup Database:**

   ```bash
   pnpm exec prisma generate
   pnpm exec prisma db push
   pnpm db:seed
   ```

5. **Start Development Server:**

   ```bash
   # Terminal 1: Main application
   pnpm dev

   # Terminal 2: Worker process (optional, for testing scheduled posts)
   pnpm start:worker
   ```

6. **Verify Setup:**
   - Application: http://localhost:3000
   - Prisma Studio: `pnpm exec prisma studio` (http://localhost:5555)
   - Health check: http://localhost:3000/healthcheck

### Development Process

1. **Create Feature Branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes:**

   - Write code following coding standards
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Locally:**

   ```bash
   # Run linter
   pnpm lint

   # Run type check
   pnpm exec tsc --noEmit

   # Run tests
   pnpm test

   # Run specific test suite
   pnpm test:unit
   pnpm test:integration
   ```

4. **Commit Changes:**

   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

5. **Push and Create PR:**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

### 1. **Database Changes**

- Use Prisma migrations for schema changes
- Test migrations locally before committing
- Update Prisma schema documentation if needed

**Creating Migrations:**

```bash
# Make changes to schema.prisma
pnpm exec prisma migrate dev --name descriptive-migration-name

# Review generated migration
# Test migration
pnpm exec prisma migrate reset  # Development only
pnpm exec prisma migrate deploy # Production
```

**Best Practices:**

- Always test migrations on a copy of production data
- Never delete migrations (they're version history)
- Document breaking changes in migration comments

### 2. **Testing**

- Test your changes thoroughly in the browser
- Verify functionality with different Nostr extensions (Alby, Amber)
- Test database operations and API endpoints

**Running Tests:**

```bash
# All tests
pnpm test

# Watch mode (recommended during development)
pnpm test:unit -- --watch

# Specific test file
pnpm test tests/unit/your-test.test.ts

# With coverage
pnpm test:coverage
```

**Writing Tests:**

- Unit tests: Test individual functions/components
- Integration tests: Test API endpoints and loaders
- E2E tests: Test user workflows (Cypress)

See [Testing Guide](./docs/testing.md) for detailed testing documentation.

### 3. **Component Development**

**Creating New Components:**

```bash
# Create component file
touch app/components/YourComponent.tsx
```

**Component Structure:**

```typescript
// app/components/YourComponent.tsx
import type { ComponentProps } from "react";

interface YourComponentProps {
  // Define props
}

export function YourComponent({ ...props }: YourComponentProps) {
  // Component implementation
  return <div>...</div>;
}
```

**Best Practices:**

- Use TypeScript for type safety
- Follow existing component patterns
- Use Tailwind CSS for styling
- Make components reusable
- Add JSDoc comments for complex components

### 4. **API Development**

**Creating API Routes:**

```typescript
// app/routes/api.your-endpoint.tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

async function loader({ request }: LoaderFunctionArgs) {
  // Handle GET requests
  return json({ data: "..." });
}

async function action({ request }: ActionFunctionArgs) {
  // Handle POST/PUT/DELETE requests
  return json({ success: true });
}
```

**Best Practices:**

- Always validate input
- Use error handling utilities
- Return consistent response formats
- Add authentication checks
- Document API endpoints

### 5. **Performance**

- Consider the impact on database queries
- Optimize image uploads and processing
- Monitor memory usage and response times

**Performance Tips:**

- Use database indexes for frequently queried columns
- Implement pagination for large datasets
- Cache expensive operations
- Optimize images before upload
- Use `select` to limit database fields

**Performance Testing:**

```bash
# Run performance tests
pnpm test:performance
```

### 6. **Security**

- Validate all user inputs
- Use proper authentication and authorization
- Follow security best practices for Nostr integration

**Security Checklist:**

- [ ] Input validation on all endpoints
- [ ] Authentication checks on protected routes
- [ ] No secrets in code (use environment variables)
- [ ] SQL injection prevention (use Prisma)
- [ ] XSS protection (sanitize user content)
- [ ] CSRF protection (use Remix Forms)

See [Security Guide](./docs/security/security.md) for detailed security practices.

### 7. **Debugging**

**Debugging Tools:**

```bash
# Node.js inspector
node --inspect server.ts
# Then open chrome://inspect in Chrome

# PM2 monitoring
pm2 monit

# Database queries
pnpm exec prisma studio

# Redis inspection
redis-cli -u $REDIS_URL
```

**Common Debugging Steps:**

1. Check application logs
2. Verify environment variables
3. Test database connection
4. Check Redis connection
5. Review error messages
6. Use browser DevTools for frontend issues

See [Troubleshooting Guide](./docs/operations/troubleshooting.md) for common issues and solutions.

---

## Code of Conduct

- Be respectful and inclusive in all interactions
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards
- Report any inappropriate behavior to project maintainers

---

By following these guidelines, you'll help us maintain an efficient and collaborative workflow that enables SmartFlowSocial to grow and improve. Thank you for contributing!
