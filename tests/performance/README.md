# Performance & Load Testing

This directory contains performance and load tests for SmartFlowSocial.

## Overview

Performance testing ensures that the application can handle expected load and meets performance benchmarks. We use two approaches:

1. **k6 Load Tests** - For API endpoints and loaders under realistic load
2. **Vitest Unit Performance Tests** - For individual function performance benchmarks

## Prerequisites

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

## Running Tests

### Unit Performance Tests

Run unit performance tests with Vitest:

```bash
npm run test:performance
```

These tests verify that individual functions meet performance benchmarks:
- `combineContent()` with various array sizes
- `getPostStats()` with different numbers of event IDs
- Bulk operations performance

### k6 Load Tests

#### API Endpoints Load Test

Test critical API endpoints under load:

```bash
k6 run tests/performance/api-endpoints.js
```

With custom base URL:

```bash
BASE_URL=https://staging.example.com k6 run tests/performance/api-endpoints.js
```

#### Bulk Operations Load Test

Test bulk operations performance:

```bash
k6 run tests/performance/bulk-operations.js
```

#### Loader Performance Test

Test Remix loader performance:

```bash
k6 run tests/performance/loader-performance.js
```

### Running All Performance Tests

```bash
npm run test:performance:all
```

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

### Unit Functions

| Function | Small (< 100) | Medium (100-1000) | Large (1000+) |
|----------|---------------|-------------------|---------------|
| `combineContent()` | < 50ms | < 200ms | < 1000ms |
| `getPostStats()` (single) | < 500ms | - | - |
| `getPostStats()` (10-50) | - | < 2000ms | - |
| `getPostStats()` (50-100) | - | - | < 5000ms |

## Test Scenarios

### 1. API Endpoints Load Test

**Purpose**: Test critical API endpoints under realistic load

**Scenarios**:
- Effective hashtags resolution
- Queue schedule calculation
- Payment status checks
- Thread view data fetching
- Link preview generation

**Load Pattern**:
- Ramp up to 10 users over 30s
- Stay at 10 users for 1m
- Ramp up to 20 users over 30s
- Stay at 20 users for 1m
- Ramp down to 0 over 30s

### 2. Bulk Operations Load Test

**Purpose**: Test bulk post operations performance

**Scenarios**:
- Bulk delete posts (10 posts)
- Bulk schedule posts (5 posts)
- Bulk sign & resume drafts (5 posts)

**Load Pattern**:
- Ramp up to 5 users over 30s
- Stay at 5 users for 1m
- Ramp up to 10 users over 30s
- Stay at 10 users for 1m
- Ramp down to 0 over 30s

### 3. Loader Performance Test

**Purpose**: Test Remix loader performance under load

**Scenarios**:
- Dashboard loader
- Scheduled posts loader
- Calendar loader
- Drafts loader
- Posted posts loader

**Load Pattern**:
- Ramp up to 10 users over 30s
- Stay at 10 users for 1m
- Ramp up to 20 users over 30s
- Stay at 20 users for 1m
- Ramp down to 0 over 30s

## Interpreting Results

### k6 Output

k6 provides detailed metrics:

- **http_req_duration**: Request duration statistics
- **http_req_failed**: Failed request rate
- **iterations**: Number of test iterations
- **vus**: Virtual users (concurrent users)

Key metrics to watch:
- **p(95)**: 95th percentile response time
- **p(99)**: 99th percentile response time
- **rate**: Error rate (should be < 1%)

### Thresholds

Tests fail if thresholds are not met:
- Response time thresholds (p95, p99)
- Error rate thresholds (< 1%)
- Custom metric thresholds

## Continuous Integration

Performance tests can be integrated into CI/CD:

```yaml
# .github/workflows/performance.yml
- name: Run Performance Tests
  run: |
    npm run test:performance
    k6 run tests/performance/api-endpoints.js
```

## Best Practices

1. **Run tests against staging/production-like environments**
2. **Baseline performance before major changes**
3. **Monitor performance trends over time**
4. **Set realistic load patterns**
5. **Test both happy paths and error scenarios**
6. **Document performance regressions**

## Troubleshooting

### k6 not found

Install k6 using the instructions above.

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

## Future Enhancements

- [ ] Stress testing (find breaking points)
- [ ] Spike testing (sudden load increases)
- [ ] Endurance testing (long-running tests)
- [ ] Database query performance tests
- [ ] Memory leak detection
- [ ] CPU profiling during load tests













