/**
 * Sentry Client-side Initialization
 * 
 * Initializes Sentry for client-side error tracking
 * Only initializes if SENTRY_DSN is configured
 */

let sentryInitialized = false;

/**
 * Initialize Sentry for client-side error tracking
 * Should be called early in the application lifecycle (e.g., in entry.client.tsx)
 */
export function initSentry(): void {
  if (sentryInitialized || typeof window === "undefined") {
    return;
  }

  // Get DSN from window.ENV (set by root.tsx)
  const dsn = (window as { ENV?: { SENTRY_DSN?: string } }).ENV?.SENTRY_DSN ?? null;

  if (!dsn) {
    // Sentry not configured - that's okay, just return
    return;
  }

  try {
    // Use dynamic import for async initialization
    void (async () => {
      try {
        const Sentry = await import("@sentry/remix");
        const isProduction = (window as { ENV?: { NODE_ENV?: string } }).ENV?.NODE_ENV === "production" || false;
        
        Sentry.init({
          dsn,
          environment: isProduction ? "production" : "development",
          // Lower sample rate for client-side to reduce noise
          tracesSampleRate: isProduction ? 0.1 : 1.0,
          // Enable session replay in production (optional)
          replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
          replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
          // Filter out noise
          beforeSend(event, hint) {
            // Don't send events for browser extensions, etc.
            if (event.exception?.values?.[0]?.value?.includes("Non-Error promise rejection")) {
              return null;
            }
            return event;
          },
          // Configure integrations
          integrations: [
            Sentry.replayIntegration(),
          ],
        });

        sentryInitialized = true;
      } catch (error) {
        // Fail silently if Sentry can't be initialized
        // This allows the app to continue working even if Sentry is misconfigured
        console.error("Failed to initialize Sentry:", error);
      }
    })();
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
 * Capture an exception in Sentry (client-side)
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
  if (!sentryInitialized || typeof window === "undefined") {
    return;
  }

  try {
    void (async () => {
      try {
        const Sentry = await import("@sentry/remix");
        Sentry.captureException(error, {
          tags: context?.tags,
          extra: context?.extra,
          user: context?.user,
          level: context?.level ?? "error",
        });
      } catch {
        // Fail silently
      }
    })();
  } catch (err) {
    // Fail silently - don't break the app if Sentry fails
    console.error("Failed to capture exception in Sentry:", err);
  }
}

/**
 * Capture a message in Sentry (client-side)
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  if (!sentryInitialized || typeof window === "undefined") {
    return;
  }

  try {
    void (async () => {
      try {
        const Sentry = await import("@sentry/remix");
        Sentry.captureMessage(message, {
          level,
          tags: context?.tags,
          extra: context?.extra,
        });
      } catch {
        // Fail silently
      }
    })();
  } catch (err) {
    // Fail silently
    console.error("Failed to capture message in Sentry:", err);
  }
}

/**
 * Set user context for Sentry (client-side)
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (!sentryInitialized || typeof window === "undefined") {
    return;
  }

  try {
    void (async () => {
      try {
        const Sentry = await import("@sentry/remix");
        Sentry.setUser(user);
      } catch {
        // Fail silently
      }
    })();
  } catch (err) {
    // Fail silently
    console.error("Failed to set user in Sentry:", err);
  }
}

/**
 * Clear user context (client-side)
 */
export function clearUser(): void {
  if (!sentryInitialized || typeof window === "undefined") {
    return;
  }

  try {
    void (async () => {
      try {
        const Sentry = await import("@sentry/remix");
        Sentry.setUser(null);
      } catch {
        // Fail silently
      }
    })();
  } catch (err) {
    // Fail silently
    console.error("Failed to clear user in Sentry:", err);
  }
}

