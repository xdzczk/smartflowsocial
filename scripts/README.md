# Scripts

This directory contains utility scripts for development and maintenance.

## Available Scripts

### `coverage-trend.js`

Tracks test coverage over time and generates trend reports.

**Usage:**

```bash
# Record current coverage
pnpm test:coverage:report

# View coverage trend
pnpm test:coverage:trend
```

### `fix-eslint-errors.js`

Automatically fixes ESLint errors in the codebase.

**Usage:**

```bash
pnpm lint:fix
```

### `check-performance-budgets.mjs`

Enforces versioned performance budgets for vitest perf tests, k6 summaries, and built frontend
assets.

**Usage:**

```bash
# Validate vitest perf budget
node scripts/check-performance-budgets.mjs --source=vitest

# Validate k6 summary budgets
node scripts/check-performance-budgets.mjs --source=k6 --dir=tests/performance/results

# Validate built bundle budgets
node scripts/check-performance-budgets.mjs --source=bundle
```

### `VERIFY_INDEXES.sql`

SQL governance check for critical database indexes. Raises exceptions on regressions (CI-safe).

**Usage:**

```bash
# Run in PostgreSQL
psql -d your_database -f scripts/VERIFY_INDEXES.sql
```

---

**Last cleanup:** 2026-01-02  
**Files removed:** 28 one-time analysis/fix scripts  
**Files kept:** 3 essential utilities
