# Error Metrics Guide

This guide covers the error metrics system that tracks error rates, types, and patterns for monitoring and alerting.

## Overview

The error metrics system automatically tracks:
- **Error counts** by error code
- **Error rates** (errors per minute)
- **Error types** (operational vs non-operational)
- **Recent errors** with context
- **Status code distribution**

## Features

### Automatic Tracking

Errors are automatically tracked when they're logged through the centralized error handling system. No additional code needed in your routes.

### In-Memory Storage

Metrics are stored in-memory by default. For production, consider:
- Redis for distributed systems
- Time-series database (InfluxDB, TimescaleDB)
- External monitoring service (Datadog, New Relic)

## Usage

### Viewing Metrics

Access metrics via the API endpoint:

```bash
# Get full metrics
GET /api/error-metrics

# Get summary with error rate
GET /api/error-metrics?summary=true

# Get top N error codes
GET /api/error-metrics?top=10

# Check if error rate is high
GET /api/error-metrics?checkRate=true
```

### Programmatic Access

```typescript
import {
  getErrorMetrics,
  getErrorRate,
  getTopErrorCodes,
  isErrorRateHigh,
} from "~/lib/error-metrics.server";

// Get full metrics summary
const metrics = getErrorMetrics();
console.log(metrics.totalErrors);
console.log(metrics.errorsByCode);

// Get error rate (errors per minute)
const rate = getErrorRate();
console.log(`Error rate: ${rate} errors/minute`);

// Check if error rate exceeds threshold
if (isErrorRateHigh(10)) {
  // Alert or take action
  console.warn("High error rate detected!");
}

// Get top error codes
const topErrors = getTopErrorCodes(5);
topErrors.forEach((error) => {
  console.log(`${error.code}: ${error.count} occurrences`);
});
```

## Metrics Structure

### ErrorMetricsSummary

```typescript
{
  totalErrors: number;
  operationalErrors: number;
  nonOperationalErrors: number;
  errorsByCode: {
    [code: string]: {
      code: string;
      count: number;
      lastOccurred: string;
      statusCode: number;
      isOperational: boolean;
    };
  };
  errorsByStatusCode: {
    [statusCode: number]: number;
  };
  recentErrors: Array<{
    code: string;
    message: string;
    timestamp: string;
    statusCode: number;
    context?: Record<string, unknown>;
  }>;
  timeRange: {
    start: string;
    end: string;
  };
}
```

## API Endpoints

### GET /api/error-metrics

Returns full error metrics.

**Response:**
```json
{
  "metrics": {
    "totalErrors": 42,
    "operationalErrors": 35,
    "nonOperationalErrors": 7,
    "errorsByCode": {
      "VALIDATION_ERROR": {
        "code": "VALIDATION_ERROR",
        "count": 15,
        "lastOccurred": "2024-01-01T12:00:00.000Z",
        "statusCode": 400,
        "isOperational": true
      }
    },
    "errorsByStatusCode": {
      "400": 15,
      "500": 7
    },
    "recentErrors": [...],
    "timeRange": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-01T12:00:00.000Z"
    }
  },
  "errorRate": 0.5
}
```

### GET /api/error-metrics?summary=true

Returns summary with error rate analysis.

**Response:**
```json
{
  "summary": { /* full metrics */ },
  "errorRate": {
    "perMinute": 0.5,
    "isHigh": false,
    "threshold": 10
  }
}
```

### GET /api/error-metrics?top=N

Returns top N error codes by count.

**Response:**
```json
{
  "topErrors": [
    {
      "code": "VALIDATION_ERROR",
      "count": 15,
      "statusCode": 400
    },
    {
      "code": "EXTERNAL_SERVICE_ERROR",
      "count": 10,
      "statusCode": 502
    }
  ]
}
```

### GET /api/error-metrics?checkRate=true

Quick check if error rate is high.

**Response:**
```json
{
  "errorRate": 0.5,
  "isHigh": false,
  "threshold": 10
}
```

## Monitoring & Alerting

### Setting Up Alerts

You can create a cron job or scheduled task to check error rates:

```typescript
// In a cron job or scheduled task
import { isErrorRateHigh, getErrorRate } from "~/lib/error-metrics.server";

export async function checkErrorRates() {
  const rate = getErrorRate();
  const isHigh = isErrorRateHigh(10); // 10 errors/minute threshold

  if (isHigh) {
    // Send alert (email, Slack, PagerDuty, etc.)
    await sendAlert({
      message: `High error rate detected: ${rate} errors/minute`,
      severity: "warning",
    });
  }
}
```

### Integration with Monitoring Services

The metrics can be exported to external monitoring services:

```typescript
import { getErrorMetrics } from "~/lib/error-metrics.server";

// Export to Prometheus
export function exportToPrometheus() {
  const metrics = getErrorMetrics();
  
  // Format for Prometheus
  return `
# HELP app_errors_total Total number of errors
# TYPE app_errors_total counter
app_errors_total ${metrics.totalErrors}

# HELP app_error_rate Errors per minute
# TYPE app_error_rate gauge
app_error_rate ${getErrorRate()}
  `;
}

// Export to Datadog
export async function exportToDatadog() {
  const metrics = getErrorMetrics();
  
  await fetch("https://api.datadoghq.com/api/v1/series", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": process.env.DATADOG_API_KEY,
    },
    body: JSON.stringify({
      series: [
        {
          metric: "app.errors.total",
          points: [[Date.now() / 1000, metrics.totalErrors]],
          type: "count",
        },
      ],
    }),
  });
}
```

## Production Considerations

### Persistence

For production, consider persisting metrics:

1. **Redis**: Store metrics with TTL
2. **Database**: Store in time-series table
3. **External Service**: Send directly to monitoring service

### Memory Management

The in-memory store keeps the last 100 errors. For high-traffic applications:
- Reduce `maxRecentErrors` if memory is a concern
- Implement periodic cleanup of old metrics
- Use external storage for long-term metrics

### Security

The `/api/error-metrics` endpoint requires authentication. In production:
- Add admin role check
- Rate limit the endpoint
- Consider IP whitelisting

Example admin check:

```typescript
import { requireAdmin } from "~/features/auth/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request); // Add this
  // ... rest of code
}
```

## Example Use Cases

### 1. Health Check Integration

```typescript
export async function healthCheck() {
  const rate = getErrorRate();
  const isHealthy = rate < 5; // Less than 5 errors/minute

  return {
    status: isHealthy ? "healthy" : "degraded",
    errorRate: rate,
  };
}
```

### 2. Dashboard Display

```typescript
// In a dashboard route
export async function loader() {
  const metrics = getErrorMetrics();
  const topErrors = getTopErrorCodes(5);

  return json({
    totalErrors: metrics.totalErrors,
    errorRate: getErrorRate(),
    topErrors,
  });
}
```

### 3. Automated Response

```typescript
// Auto-disable feature if error rate is too high
export async function checkFeatureHealth() {
  const topErrors = getTopErrorCodes(1);
  const mainError = topErrors[0];

  if (mainError?.code === "EXTERNAL_SERVICE_ERROR" && mainError.count > 50) {
    // Disable feature that depends on external service
    await disableFeature("external-service-integration");
  }
}
```

## Testing

Reset metrics for testing:

```typescript
import { resetErrorMetrics } from "~/lib/error-metrics.server";

beforeEach(() => {
  resetErrorMetrics();
});
```

## Future Enhancements

Potential improvements:
- [ ] Time-windowed metrics (last hour, last day)
- [ ] Error trend analysis
- [ ] Automatic alerting integration
- [ ] Metrics persistence to database
- [ ] Export to Prometheus/Grafana
- [ ] Error correlation analysis


