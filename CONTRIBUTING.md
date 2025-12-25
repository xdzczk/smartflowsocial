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
- **PostgreSQL**: Database server (local or remote)
- **Git**: For version control

### 1. Install Dependencies

```bash
npm install
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
npx prisma generate

# Run database push command
npx prisma db push

```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 5. Using Docker (Optional)

For a quick setup with PostgreSQL:

```bash
npm run docker
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
- Run `npm run lint` to check for issues
- Run `npm run format` to auto-format code
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
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp example.env .env
   # Edit .env with your local configuration
   ```

3. **Start Services:**
   ```bash
   # Start PostgreSQL and Redis with Docker
   npm run docker
   
   # Or use existing services
   # Set DATABASE_URL and REDIS_URL in .env
   ```

4. **Setup Database:**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

5. **Start Development Server:**
   ```bash
   # Terminal 1: Main application
   npm run dev
   
   # Terminal 2: Worker process (optional, for testing scheduled posts)
   npm run start:worker
   ```

6. **Verify Setup:**
   - Application: http://localhost:3000
   - Prisma Studio: `npx prisma studio` (http://localhost:5555)
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
   npm run lint
   
   # Run type check
   npx tsc --noEmit
   
   # Run tests
   npm test
   
   # Run specific test suite
   npm run test:unit
   npm run test:integration
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
npx prisma migrate dev --name descriptive-migration-name

# Review generated migration
# Test migration
npx prisma migrate reset  # Development only
npx prisma migrate deploy # Production
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
npm test

# Watch mode (recommended during development)
npm run test:unit -- --watch

# Specific test file
npm test tests/unit/your-test.test.ts

# With coverage
npm run test:coverage
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

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle GET requests
  return json({ data: "..." });
}

export async function action({ request }: ActionFunctionArgs) {
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
npm run test:performance
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

See [Security Guide](./docs/SECURITY.md) for detailed security practices.

### 7. **Debugging**

**Debugging Tools:**
```bash
# Node.js inspector
node --inspect server.ts
# Then open chrome://inspect in Chrome

# PM2 monitoring
pm2 monit

# Database queries
npx prisma studio

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

See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) for common issues and solutions.

---

## Code of Conduct

- Be respectful and inclusive in all interactions
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards
- Report any inappropriate behavior to project maintainers

---

By following these guidelines, you'll help us maintain an efficient and collaborative workflow that enables SmartFlowSocial to grow and improve. Thank you for contributing!
