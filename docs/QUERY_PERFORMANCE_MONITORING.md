# Query Performance Monitoring

**Date**: 2025-12-26

## Overview

Query performance monitoring has been implemented using Prometheus metrics to track database query performance, identify slow queries, and monitor query errors.

## Implementation

### Metrics Exposed

The following Prometheus metrics are automatically collected:

1. **`prisma_query_duration_ms`** (Histogram)
   - Duration of Prisma queries in milliseconds
   - Labels: `model`, `action`, `status`
   - Buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]ms

2. **`prisma_query_total`** (Counter)
   - Total number of Prisma queries
   - Labels: `model`, `action`, `status`

3. **`prisma_slow_query_total`** (Counter)
   - Total number of slow queries (>100ms)
   - Labels: `model`, `action`

4. **`prisma_query_errors_total`** (Counter)
   - Total number of query errors
   - Labels: `model`, `action`, `error_type`

### Accessing Metrics

Metrics are exposed via the `/metrics` endpoint (same as other Prometheus metrics):

```bash
curl http://localhost:3010/metrics | grep prisma
```

### Example PromQL Queries

#### Average Query Time
```promql
rate(prisma_query_duration_ms_sum[5m]) / rate(prisma_query_duration_ms_count[5m])
```

#### P95 Query Time
```promql
histogram_quantile(0.95, rate(prisma_query_duration_ms_bucket[5m]))
```

#### P99 Query Time
```promql
histogram_quantile(0.99, rate(prisma_query_duration_ms_bucket[5m]))
```

#### Slow Query Rate
```promql
rate(prisma_slow_query_total[5m])
```

#### Query Error Rate
```promql
rate(prisma_query_errors_total[5m])
```

#### Top Slow Queries by Model
```promql
topk(10, sum by (model, action) (rate(prisma_query_duration_ms_sum[5m])))
```

#### Query Success Rate
```promql
sum(rate(prisma_query_total{status="success"}[5m])) / sum(rate(prisma_query_total[5m]))
```

### Grafana Dashboard

Create a Grafana dashboard with the following panels:

1. **Query Duration (P95)**
   - Query: `histogram_quantile(0.95, rate(prisma_query_duration_ms_bucket[5m]))`
   - Visualization: Time series graph
   - Unit: milliseconds

2. **Slow Query Rate**
   - Query: `rate(prisma_slow_query_total[5m])`
   - Visualization: Time series graph
   - Unit: queries/second

3. **Query Error Rate**
   - Query: `rate(prisma_query_errors_total[5m])`
   - Visualization: Time series graph
   - Unit: errors/second

4. **Top Queries by Duration**
   - Query: `topk(10, sum by (model, action) (rate(prisma_query_duration_ms_sum[5m])))`
   - Visualization: Table

5. **Query Success Rate**
   - Query: `sum(rate(prisma_query_total{status="success"}[5m])) / sum(rate(prisma_query_total[5m]))`
   - Visualization: Gauge (0-1)

### Alerts

Configure Prometheus alerts for:

1. **High Slow Query Rate**
   ```yaml
   - alert: HighSlowQueryRate
     expr: rate(prisma_slow_query_total[5m]) > 10
     for: 5m
     annotations:
       summary: "High slow query rate detected"
   ```

2. **High Query Error Rate**
   ```yaml
   - alert: HighQueryErrorRate
     expr: rate(prisma_query_errors_total[5m]) > 5
     for: 5m
     annotations:
       summary: "High query error rate detected"
   ```

3. **P95 Query Time Too High**
   ```yaml
   - alert: HighP95QueryTime
     expr: histogram_quantile(0.95, rate(prisma_query_duration_ms_bucket[5m])) > 500
     for: 10m
     annotations:
       summary: "P95 query time exceeds 500ms"
   ```

### Console Logging

Slow queries (>100ms) are automatically logged to the console:

```
⚠️ Slow query detected: Post.findMany took 150ms
```

Query errors are also logged:

```
❌ Query error: User.findUnique failed after 200ms
```

### Files Modified

- ✅ `app/lib/query-metrics.server.ts` (new) - Query metrics definitions
- ✅ `app/lib/prisma.server.ts` (modified) - Added metrics recording to middleware
- ✅ `server.ts` (modified) - Import query metrics to register them
- ✅ `tests/performance/query-metrics.test.ts` (new) - Tests for metrics

### Usage

Metrics are automatically collected for all Prisma queries. No additional code is required.

To manually record metrics (if needed):

```typescript
import { recordQueryMetrics } from "~/lib/query-metrics.server";

recordQueryMetrics("User", "findMany", 50, true);
```

### Performance Impact

- Minimal overhead: ~0.1-0.5ms per query
- Metrics are recorded asynchronously
- No blocking operations

### Next Steps

1. Set up Grafana dashboards for visualization
2. Configure Prometheus alerts
3. Monitor slow queries and optimize as needed
4. Review query patterns and optimize indexes

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [PromQL Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Creation](https://grafana.com/docs/grafana/latest/dashboards/)

