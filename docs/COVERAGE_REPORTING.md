# Test Coverage Reporting & Tracking

**Date**: 2025-12-25  
**Status**: ✅ Configured

## Overview

Comprehensive test coverage reporting and tracking has been set up to monitor test coverage, enforce thresholds, and track coverage trends over time.

## Configuration

### Vitest Coverage Configuration

Coverage is configured in `vitest.config.ts` with the following settings:

- **Provider**: v8 (fast and accurate)
- **Reporters**: text, json, json-summary, html, lcov
- **Thresholds**:
  - Lines: 70%
  - Functions: 65%
  - Branches: 60%
  - Statements: 70%

### Coverage Exclusions

The following are excluded from coverage:
- `node_modules/`
- `build/`
- `tests/e2e/`
- `tests/`
- `prisma/`
- Type definitions (`**/*.d.ts`)
- Config files (`**/*.config.*`)
- Entry files (`**/entry.*`)
- Root component (`**/root.tsx`)
- Styles (`**/tailwind.css`)
- Server files (`server.ts`, `worker.ts`)

## Running Coverage Reports

### Basic Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage with Thresholds Check

```bash
# Run coverage and check thresholds
./scripts/coverage-report.sh
```

This script:
1. Runs tests with coverage
2. Generates coverage reports
3. Checks if thresholds are met
4. Exits with error if thresholds not met

### Coverage Trend Tracking

```bash
# Record current coverage snapshot
node scripts/coverage-trend.js record

# View coverage trend report
node scripts/coverage-trend.js report
```

The trend tracking:
- Records coverage snapshots over time
- Keeps last 100 snapshots
- Shows coverage trends (increasing/decreasing)
- Helps identify coverage regressions

## Coverage Reports

### HTML Report

The most detailed report is the HTML report:

```bash
npm run test:coverage
open coverage/index.html
```

This shows:
- File-by-file coverage
- Line-by-line highlighting
- Branch coverage details
- Function coverage details

### JSON Summary

The JSON summary (`coverage/coverage-summary.json`) contains:
- Overall coverage percentages
- Per-file coverage
- Per-directory coverage

Useful for:
- CI/CD integration
- Coverage tracking tools
- Automated reporting

### LCOV Report

The LCOV report (`coverage/lcov.info`) is compatible with:
- Codecov
- Coveralls
- SonarQube
- Other coverage tools

## CI/CD Integration

### GitHub Actions

A GitHub Actions workflow (`.github/workflows/coverage.yml`) is configured to:
1. Run tests with coverage on PRs and pushes
2. Check coverage thresholds
3. Upload coverage to Codecov (if configured)
4. Comment on PRs with coverage information
5. Upload coverage artifacts

### Codecov Integration

To enable Codecov:

1. Sign up at [codecov.io](https://codecov.io)
2. Add your repository
3. Get your Codecov token
4. Add `CODECOV_TOKEN` to GitHub secrets
5. The workflow will automatically upload coverage

### Coverage Badges

Add coverage badges to your README:

```markdown
[![Coverage](https://codecov.io/gh/your-org/your-repo/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/your-repo)
```

## Coverage Thresholds

### Current Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Lines | 70% | Ensures most code paths are tested |
| Functions | 65% | Ensures most functions have tests |
| Branches | 60% | Ensures conditional logic is tested |
| Statements | 70% | Ensures most statements execute |

### Adjusting Thresholds

Edit `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 75,      // Increase to 75%
    functions: 70,  // Increase to 70%
    branches: 65,   // Increase to 65%
    statements: 75, // Increase to 75%
  },
}
```

### Threshold Strategy

1. **Start Low**: Begin with achievable thresholds (50-60%)
2. **Gradually Increase**: Raise thresholds as coverage improves
3. **Maintain**: Keep thresholds at sustainable levels
4. **Per-File**: Consider per-file thresholds for critical code

## Coverage Tracking

### Trend Analysis

Track coverage over time:

```bash
# Record snapshot after each test run
npm run test:coverage && node scripts/coverage-trend.js record

# View trends
node scripts/coverage-trend.js report
```

### Coverage Goals

Set coverage goals and track progress:

- **Current**: ~70-75% overall coverage
- **Short-term Goal**: 75% overall coverage
- **Long-term Goal**: 80% overall coverage
- **Critical Code**: 90%+ coverage (business logic, security)

## Best Practices

### 1. Regular Coverage Checks

Run coverage checks regularly:
- Before committing
- In CI/CD pipeline
- Before releases

### 2. Coverage Reviews

Review coverage reports:
- Identify untested code paths
- Find missing edge cases
- Discover dead code

### 3. Incremental Improvement

Improve coverage incrementally:
- Focus on high-impact areas first
- Add tests for new code
- Gradually increase thresholds

### 4. Coverage vs Quality

Remember:
- **Coverage ≠ Quality**: High coverage doesn't mean good tests
- **Focus on Critical Paths**: Some code needs more coverage than others
- **Avoid Coverage Gaming**: Don't write tests just to increase coverage

## Troubleshooting

### Coverage Not Generating

1. Check that `@vitest/coverage-v8` is installed
2. Verify coverage provider in `vitest.config.ts`
3. Check that tests are actually running

### Thresholds Not Enforced

1. Verify thresholds in `vitest.config.ts`
2. Check that coverage is actually below threshold
3. Ensure `reportOnFailure: true` is set

### Coverage Reports Missing Files

1. Check exclusion patterns in `vitest.config.ts`
2. Verify files are in included directories
3. Check that files are actually executed by tests

## Future Enhancements

Consider adding:
- **Per-file thresholds**: Different thresholds for different file types
- **Coverage diff**: Show coverage changes in PRs
- **Coverage alerts**: Notify when coverage drops
- **Coverage visualization**: Charts and graphs
- **Coverage badges**: Dynamic badges in README

## Resources

- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)
- [Codecov Documentation](https://docs.codecov.com/)
- [Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)

