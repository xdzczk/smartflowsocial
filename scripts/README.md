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

### `VERIFY_INDEXES.sql`

SQL queries to verify database indexes are properly created.

**Usage:**

```bash
# Run in PostgreSQL
psql -d your_database -f scripts/VERIFY_INDEXES.sql
```

---

**Last cleanup:** 2026-01-02  
**Files removed:** 28 one-time analysis/fix scripts  
**Files kept:** 3 essential utilities





