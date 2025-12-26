# Sentry Error Tracking Setup

**Date**: 2025-12-26  
**Status**: ✅ Integrated

---

## Overview

Sentry has been integrated into the codebase for production error tracking and monitoring. The integration is **optional** - the application will work fine without it, but Sentry provides valuable insights when configured.

---

## Installation

### 1. Install Sentry Package

```bash
npm install @sentry/remix
```

### 2. Get Your Sentry DSN

1. Sign up for a free account at [https://sentry.io](https://sentry.io)
2. Create a new project (select "Remix" as the framework)
3. Copy your DSN from the project settings

### 3. Configure Environment Variable

Add your Sentry DSN to your `.env` file:

```bash
SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

**Note**: 
- The DSN is optional. If not provided, Sentry will not initialize and the app will continue to work normally.
- The DSN is automatically exposed to the client-side via `root.tsx` loader (it's safe - Sentry DSNs are public keys)
- For server-side, the DSN is read directly from `process.env.SENTRY_DSN`

---

## How It Works

### Automatic Integration

Sentry is automatically initialized when:
- `SENTRY_DSN` environment variable is set
- The application starts (server-side) or loads (client-side)

### Error Logging

All errors logged through the centralized logging system are automatically sent to Sentry:

- **Server-side**: `logError()` in `app/lib/error-logger.server.ts` automatically sends to Sentry
- **Client-side**: `logClientError()` in `app/lib/error-handler.client.ts` automatically sends to Sentry

### What Gets Sent

- Error messages and stack traces
- User context (user ID, if available)
- Request context (path, method, user agent, IP)
- Custom tags (error codes, status codes)
- Custom extra data (from log context)

### What Gets Filtered

- Sensitive data is automatically sanitized (NWC strings, secrets, etc.)
- Health check endpoints are filtered out
- Browser extension errors are filtered out (client-side)

---

## Files Modified

### New Files

1. **`app/lib/sentry.server.ts`** - Server-side Sentry initialization and utilities
2. **`app/lib/sentry.client.ts`** - Client-side Sentry initialization and utilities

### Modified Files

1. **`app/lib/error-logger.server.ts`** - Integrated Sentry captureException
2. **`app/lib/error-handler.client.ts`** - Integrated Sentry captureException
3. **`app/entry.server.tsx`** - Initialize Sentry on server startup
4. **`app/entry.client.tsx`** - Initialize Sentry on client startup
5. **`example.env`** - Added SENTRY_DSN variable

---

## Usage

### Automatic (Recommended)

Errors are automatically sent to Sentry when you use the centralized logging:

```typescript
// Server-side
import { logError } from "~/lib/error-logger.server";

try {
  // Your code
} catch (error) {
  logError(error, {
    userId: user.id,
    path: request.url,
    message: "Error processing payment",
  });
  // Automatically sent to Sentry!
}
```

```typescript
// Client-side
import { logClientError } from "~/lib/error-handler.client";

try {
  // Your code
} catch (error) {
  logClientError(error, {
    component: "PaymentForm",
    action: "submit",
  });
  // Automatically sent to Sentry!
}
```

### Manual (Advanced)

You can also use Sentry directly if needed:

```typescript
// Server-side
import { captureException, setUser } from "~/lib/sentry.server";

captureException(error, {
  tags: { feature: "payments" },
  extra: { paymentId: "123" },
  user: { id: user.id },
});

// Set user context for all future errors
setUser({ id: user.id, email: user.email });
```

```typescript
// Client-side
import { captureException } from "~/lib/sentry.client";

captureException(error, {
  tags: { component: "PaymentForm" },
  extra: { formData: sanitizedData },
});
```

---

## Configuration

### Sample Rates

Sample rates are configured in `app/lib/sentry.server.ts` and `app/lib/sentry.client.ts`:

- **Production**: 10% of transactions (to reduce noise)
- **Development**: 100% of transactions (for debugging)

You can adjust these in the initialization code:

```typescript
tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
```

### Filtering

Health checks and other noise are automatically filtered. You can add custom filters in the `beforeSend` hook in the Sentry initialization files.

---

## Testing

### Test Sentry Integration

1. Set `SENTRY_DSN` in your `.env` file
2. Trigger an error in your application
3. Check your Sentry dashboard - you should see the error appear within seconds

### Test Without Sentry

1. Remove or comment out `SENTRY_DSN` in your `.env` file
2. The application should work normally
3. Errors will still be logged to console (as before)

---

## Production Checklist

- [ ] Install `@sentry/remix` package
- [ ] Create Sentry account and project
- [ ] Add `SENTRY_DSN` to production environment variables
- [ ] Test error reporting in staging environment
- [ ] Configure alerting rules in Sentry dashboard
- [ ] Set up release tracking (optional)
- [ ] Configure source maps for better stack traces (optional)

---

## Benefits

✅ **Automatic Error Tracking** - All errors logged through centralized system are tracked  
✅ **User Context** - See which users are affected  
✅ **Request Context** - See what requests caused errors  
✅ **Error Grouping** - Similar errors are automatically grouped  
✅ **Alerting** - Get notified when errors spike  
✅ **Performance Monitoring** - Track slow requests (optional)  
✅ **Session Replay** - See user sessions that led to errors (optional)  

---

## Cost

Sentry offers a **free tier** that includes:
- 5,000 errors/month
- 10,000 performance units/month
- 1 project
- 30-day error history

For most applications, this is sufficient. Paid plans start at $26/month for more errors and features.

---

## Troubleshooting

### Sentry Not Capturing Errors

1. Check that `SENTRY_DSN` is set in your environment
2. Check browser console for Sentry initialization errors
3. Verify Sentry is initialized: Check `isSentryInitialized()` function
4. Check Sentry dashboard for any configuration issues

### Too Many Errors

1. Adjust sample rates in initialization files
2. Add more filters in `beforeSend` hook
3. Configure error grouping rules in Sentry dashboard

### Sensitive Data in Sentry

1. Ensure you're using `logError()` which automatically sanitizes data
2. Check `app/lib/secrets-sanitizer.server.ts` for sanitization rules
3. Add custom sanitization if needed

---

## Next Steps

1. **Install the package**: `npm install @sentry/remix`
2. **Get your DSN**: Sign up at sentry.io and create a project
3. **Add to .env**: Set `SENTRY_DSN=your-dsn-here`
4. **Test it**: Trigger an error and check Sentry dashboard
5. **Configure alerts**: Set up alerts for critical errors in Sentry dashboard

---

**Last Updated**: 2025-12-26

