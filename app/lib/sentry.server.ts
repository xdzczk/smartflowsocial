/**
 * Sentry Server-side Initialization
 * 
 * Initializes Sentry for server-side error tracking
 * Only initializes if SENTRY_DSN is configured
 */

let sentryInitialized = false;

/**
 * Initialize Sentry for server-side error tracking
 * Should be called early in the application lifecycle (e.g., in entry.server.tsx)
 */
export function initSentry(): void {
  // Only initialize if DSN is provided and not already initialized
  if (sentryInitialized || !process.env.SENTRY_DSN) {
    return;
  }

  try {
    // Dynamic import to avoid bundling Sentry in production if not configured
     
    const Sentry = require("@sentry/remix") as {
      init: (options: {
        dsn?: string;
        environment?: string;
        tracesSampleRate?: number;
        profilesSampleRate?: number;
        beforeSend?: (event: unknown, hint: unknown) => unknown;
        integrations?: unknown[];
      }) => void;
      captureException: (error: Error, options?: unknown) => void;
      captureMessage: (message: string, level?: string) => void;
      setUser: (user: { id?: string; email?: string }) => void;
    };
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      // Adjust traces sample rate based on environment
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Enable profiling in production (optional)
      profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Filter out health checks and other noise
      beforeSend(event: unknown, _hint: unknown) {
        // Don't send events for health checks
        const sentryEvent = event as { request?: { url?: string } };
        if (sentryEvent.request?.url?.includes("/health")) {
          return null;
        }
        return event;
      },
      // Configure integrations
      integrations: [
        // Add any custom integrations here
      ],
    });

    sentryInitialized = true;
  } catch (error) {
    // Fail silently if Sentry can't be initialized
    // This allows the app to continue working even if Sentry is misconfigured
    console.error("Failed to initialize Sentry:", error);
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Capture an exception in Sentry
 * Safe to call even if Sentry is not initialized
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
    level?: "fatal" | "error" | "warning" | "info" | "debug";
  },
): void {
  if (!sentryInitialized || !process.env.SENTRY_DSN) {
    return;
  }

  try {
     
    const Sentry = require("@sentry/remix") as {
      captureException: (error: Error, options?: unknown) => void;
    };
    
    Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      level: context?.level ?? "error",
    });
  } catch (err) {
    // Fail silently - don't break the app if Sentry fails
    console.error("Failed to capture exception in Sentry:", err);
  }
}

/**
 * Capture a message in Sentry
 * Useful for tracking important events
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  if (!sentryInitialized || !process.env.SENTRY_DSN) {
    return;
  }

  try {
     
    const Sentry = require("@sentry/remix") as {
      captureMessage: (message: string, options?: unknown) => void;
    };
    
    Sentry.captureMessage(message, {
      level,
      tags: context?.tags,
      extra: context?.extra,
    });
  } catch (err) {
    // Fail silently - don't break the app if Sentry fails
    console.error("Failed to capture message in Sentry:", err);
  }
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (!sentryInitialized || !process.env.SENTRY_DSN) {
    return;
  }

  try {
     
    const Sentry = require("@sentry/remix") as {
      setUser: (user: { id?: string; email?: string; username?: string }) => void;
    };
    Sentry.setUser(user);
  } catch (err) {
    // Fail silently
    console.error("Failed to set user in Sentry:", err);
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!sentryInitialized || !process.env.SENTRY_DSN) {
    return;
  }

  try {
     
    const Sentry = require("@sentry/remix") as {
      setUser: (user: null) => void;
    };
    Sentry.setUser(null);
  } catch (err) {
    // Fail silently
    console.error("Failed to clear user in Sentry:", err);
  }
}

