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

- **Node.js**: Version 18.0.0 or higher
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

### 1. **Database Changes**

- Use Prisma migrations for schema changes
- Test migrations locally before committing
- Update Prisma schema documentation if needed

### 2. **Testing**

- Test your changes thoroughly in the browser
- Verify functionality with different Nostr extensions (Alby, Amber)
- Test database operations and API endpoints

### 3. **Performance**

- Consider the impact on database queries
- Optimize image uploads and processing
- Monitor memory usage and response times

### 4. **Security**

- Validate all user inputs
- Use proper authentication and authorization
- Follow security best practices for Nostr integration

---

## Code of Conduct

- Be respectful and inclusive in all interactions
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards
- Report any inappropriate behavior to project maintainers

---

By following these guidelines, you'll help us maintain an efficient and collaborative workflow that enables SmartFlowSocial to grow and improve. Thank you for contributing!
