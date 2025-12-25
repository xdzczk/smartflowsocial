# Performance Testing Guide

**Date**: 2025-12-25  
**Status**: ✅ Implemented

## Overview

Performance testing ensures that SmartFlowSocial can handle expected load and meets performance benchmarks. We use a combination of:

1. **k6 Load Tests** - For API endpoints and loaders under realistic load
2. **Vitest Unit Performance Tests** - For individual function performance benchmarks

## Quick Start

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

Or download from [k6.io](https://k6.io/docs/getting-started/installation/)

### Run Tests

```bash
# Unit performance tests
npm run test:performance

# k6 load tests
k6 run tests/performance/api-endpoints.js
k6 run tests/performance/bulk-operations.js
k6 run tests/performance/loader-performance.js
```

## Test Types

### 1. Unit Performance Tests

Located in `tests/performance/unit-performance.test.ts`, these tests verify that individual functions meet performance benchmarks.

**Tested Functions:**
- `combineContent()` - Content combining with various array sizes
- `getPostStats()` - Statistics fetching with different numbers of event IDs
- Bulk operations - Bulk post creation and updates

**Performance Benchmarks:**

| Function | Small (< 100) | Medium (100-1000) | Large (1000+) |
|----------|---------------|-------------------|---------------|
| `combineContent()` | < 50ms | < 200ms | < 1000ms |
| `getPostStats()` (single) | < 500ms | - | - |
| `getPostStats()` (10-50) | - | < 2000ms | - |
| `getPostStats()` (50-100) | - | - | < 5000ms |

### 2. k6 Load Tests

#### API Endpoints Load Test

Tests critical API endpoints under realistic load:

```bash
k6 run tests/performance/api-endpoints.js
```

**Tested Endpoints:**
- `/api/effective-hashtags` - Hashtag resolution
- `/api/queue-schedule` - Schedule calculation
- `/api/payment-status` - Payment status checks
- `/api/thread-view` - Thread data fetching
- `/api/link-preview` - Link preview generation

**Load Pattern:**
- Ramp up to 10 users over 30s
- Stay at 10 users for 1m
- Ramp up to 20 users over 30s
- Stay at 20 users for 1m
- Ramp down to 0 over 30s

**Performance Targets:**
- p95 response time < 2s
- p99 response time < 5s
- Error rate < 1%

#### Bulk Operations Load Test

Tests bulk post operations performance:

```bash
k6 run tests/performance/bulk-operations.js
```

**Tested Operations:**
- Bulk delete posts (10 posts)
- Bulk schedule posts (5 posts)
- Bulk sign & resume drafts (5 posts)

**Load Pattern:**
- Ramp up to 5 users over 30s
- Stay at 5 users for 1m
- Ramp up to 10 users over 30s
- Stay at 10 users for 1m
- Ramp down to 0 over 30s

#### Loader Performance Test

Tests Remix loader performance under load:

```bash
k6 run tests/performance/loader-performance.js
```

**Tested Loaders:**
- `/dashboard` - Dashboard loader
- `/dashboard/scheduled` - Scheduled posts loader
- `/dashboard/calendar` - Calendar loader
- `/dashboard/drafts` - Drafts loader
- `/dashboard/posted` - Posted posts loader

**Load Pattern:**
- Ramp up to 10 users over 30s
- Stay at 10 users for 1m
- Ramp up to 20 users over 30s
- Stay at 20 users for 1m
- Ramp down to 0 over 30s

## Performance Benchmarks

### API Endpoints

| Endpoint | Target p95 | Target p99 |
|----------|-----------|------------|
| `/api/effective-hashtags` | < 1s | < 2s |
| `/api/queue-schedule` | < 500ms | < 1s |
| `/api/upload` | < 5s | < 10s |
| `/api/publish` | < 3s | < 5s |
| `/api/payment-status` | < 2s | < 4s |
| `/api/thread-view` | < 2s | < 4s |
| `/api/link-preview` | < 3s | < 5s |

### Loaders

| Loader | Target p95 | Target p99 |
|--------|-----------|------------|
| `/dashboard` | < 2s | < 4s |
| `/dashboard/scheduled` | < 2s | < 4s |
| `/dashboard/calendar` | < 3s | < 5s |
| `/dashboard/drafts` | < 2s | < 4s |
| `/dashboard/posted` | < 2s | < 4s |

## Interpreting Results

### k6 Output

k6 provides detailed metrics:

- **http_req_duration**: Request duration statistics
  - `avg`: Average response time
  - `min`: Minimum response time
  - `med`: Median response time
  - `max`: Maximum response time
  - `p(90)`: 90th percentile
  - `p(95)`: 95th percentile
  - `p(99)`: 99th percentile
- **http_req_failed**: Failed request rate
- **iterations**: Number of test iterations
- **vus**: Virtual users (concurrent users)

### Key Metrics

- **p(95)**: 95% of requests complete within this time
- **p(99)**: 99% of requests complete within this time
- **rate**: Error rate (should be < 1%)

### Thresholds

Tests fail if thresholds are not met:
- Response time thresholds (p95, p99)
- Error rate thresholds (< 1%)
- Custom metric thresholds

## Customization

### Changing Load Patterns

Edit the `stages` in k6 test files:

```javascript
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up
    { duration: "1m", target: 10 },  // Stay
    { duration: "30s", target: 0 },  // Ramp down
  ],
};
```

### Changing Base URL

Set the `BASE_URL` environment variable:

```bash
BASE_URL=https://staging.example.com k6 run tests/performance/api-endpoints.js
```

### Adding New Tests

1. Create a new k6 test file in `tests/performance/`
2. Import utilities from `k6-setup.js`
3. Define load pattern in `options`
4. Implement test scenarios in `default` function
5. Add to CI/CD workflow if needed

## CI/CD Integration

Performance tests are integrated into GitHub Actions:

- **Unit performance tests**: Run on every PR
- **Load tests**: Run on schedule or manual trigger

See `.github/workflows/performance.yml` for details.

## Best Practices

1. **Baseline First**: Establish performance baselines before major changes
2. **Test Realistic Scenarios**: Use realistic load patterns and data
3. **Monitor Trends**: Track performance over time
4. **Test Staging**: Run tests against staging/production-like environments
5. **Document Regressions**: Document any performance regressions
6. **Optimize Incrementally**: Fix performance issues incrementally

## Troubleshooting

### k6 not found

Install k6 using the instructions in the Quick Start section.

### Tests timing out

- Check server is running
- Verify BASE_URL is correct
- Check network connectivity
- Review server logs for errors

### High error rates

- Check server capacity
- Review database performance
- Check external API dependencies
- Review server logs

### Slow response times

- Check database query performance
- Review N+1 query issues
- Check external API response times
- Review caching strategies

## Future Enhancements

- [ ] Stress testing (find breaking points)
- [ ] Spike testing (sudden load increases)
- [ ] Endurance testing (long-running tests)
- [ ] Database query performance tests
- [ ] Memory leak detection
- [ ] CPU profiling during load tests
- [ ] Real user monitoring (RUM) integration
- [ ] Performance budgets in CI/CD

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/using-k6/best-practices/)
- [Performance Testing Guide](https://k6.io/docs/test-types/performance-testing/)

