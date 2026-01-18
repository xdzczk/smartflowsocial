/**
 * Sentry Server-side Initialization
 *
 * Initializes Sentry for server-side error tracking
 * Only initializes if SENTRY_DSN is configured
 */

import { safeConsoleError } from "~/lib/secrets-sanitizer.server";

let sentryInitialized = false;

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Initialize Sentry for server-side error tracking
 * Should be called early in the application lifecycle (e.g., in entry.server.tsx)
 */
export function initSentry(): void {
  // Only initialize if DSN is provided and not already initialized
  if (sentryInitialized || !process.env["SENTRY_DSN"]) {
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
        beforeSendTransaction?: (event: unknown, hint: unknown) => unknown;
        integrations?: unknown[];
      }) => void;
      captureException: (error: Error, options?: unknown) => void;
      captureMessage: (message: string, level?: string) => void;
      setUser: (user: { id?: string; email?: string }) => void;
    };

    const isProduction = process.env["NODE_ENV"] === "production";
    const tracesSampleRate = parseSampleRate(
      process.env["SENTRY_TRACES_SAMPLE_RATE"],
      isProduction ? 0.1 : 1.0
    );
    const profilesSampleRate = parseSampleRate(
      process.env["SENTRY_PROFILES_SAMPLE_RATE"],
      isProduction ? 0.1 : 1.0
    );

    Sentry.init({
      dsn: process.env["SENTRY_DSN"],
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: process.env.NODE_ENV may be undefined in some environments
      environment: process.env["NODE_ENV"] ?? "development",
      // Adjust traces sample rate based on environment
      tracesSampleRate,
      // Enable profiling in production (optional)
      profilesSampleRate,
      // Filter out health checks and other noise
      beforeSend(event: unknown, _hint: unknown) {
        // Don't send events for health checks
        const sentryEvent = event as { request?: { url?: string } };
        const url = sentryEvent.request?.url ?? "";
        if (
          url.includes("/health") ||
          url.includes("/metrics") ||
          url.includes("/favicon.ico") ||
          url.includes("/robots.txt")
        ) {
          return null;
        }
        return event;
      },
      beforeSendTransaction(event: unknown, _hint: unknown) {
        const sentryEvent = event as {
          transaction?: string;
          request?: { url?: string };
        };
        const url = sentryEvent.request?.url ?? "";
        const txn = sentryEvent.transaction ?? "";
        const haystack = `${txn} ${url}`;
        if (
          haystack.includes("/health") ||
          haystack.includes("/metrics") ||
          haystack.includes("/favicon.ico") ||
          haystack.includes("/robots.txt")
        ) {
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
    safeConsoleError("Failed to initialize Sentry:", error);
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
  }
): void {
  if (!sentryInitialized || !process.env["SENTRY_DSN"]) {
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
    safeConsoleError("Failed to capture exception in Sentry:", err);
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
  }
): void {
  if (!sentryInitialized || !process.env["SENTRY_DSN"]) {
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
    safeConsoleError("Failed to capture message in Sentry:", err);
  }
}

/**
 * Add a breadcrumb to Sentry.
 * Safe to call even if Sentry is not initialized.
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  data?: Record<string, unknown>;
}): void {
  if (!sentryInitialized || !process.env["SENTRY_DSN"]) {
    return;
  }

  try {
    const Sentry = require("@sentry/remix") as {
      addBreadcrumb: (breadcrumb: unknown) => void;
    };

    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category,
      level: breadcrumb.level ?? "info",
      data: breadcrumb.data,
    });
  } catch (err) {
    // Fail silently - don't break the app if Sentry fails
    safeConsoleError("Failed to add breadcrumb in Sentry:", err);
  }
}

/**
 * Set user context for Sentry
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
}): void {
  if (!sentryInitialized || !process.env["SENTRY_DSN"]) {
    return;
  }

  try {
    const Sentry = require("@sentry/remix") as {
      setUser: (user: {
        id?: string;
        email?: string;
        username?: string;
      }) => void;
    };
    Sentry.setUser(user);
  } catch (err) {
    // Fail silently
    safeConsoleError("Failed to set user in Sentry:", err);
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!sentryInitialized || !process.env["SENTRY_DSN"]) {
    return;
  }

  try {
    const Sentry = require("@sentry/remix") as {
      setUser: (user: null) => void;
    };
    Sentry.setUser(null);
  } catch (err) {
    // Fail silently
    safeConsoleError("Failed to clear user in Sentry:", err);
  }
}

export async function withSentrySpan<T>(
  span: {
    name: string;
    op?: string;
    attributes?: Record<string, unknown>;
  },
  fn: () => Promise<T> | T
): Promise<T> {
  if (!sentryInitialized || !process.env["SENTRY_DSN"]) {
    return await fn();
  }

  try {
    const Sentry = require("@sentry/remix") as Record<string, unknown>;
    const startSpan = Sentry["startSpan"];
    const startSpanManual = Sentry["startSpanManual"];

    if (typeof startSpan === "function") {
      return await (
        startSpan as (ctx: unknown, cb: () => Promise<T>) => Promise<T>
      )(
        {
          name: span.name,
          op: span.op,
          attributes: span.attributes,
        },
        async () => await fn()
      );
    }

    if (typeof startSpanManual === "function") {
      const spanObj = (
        startSpanManual as (ctx: unknown) => { end?: () => void }
      )({
        name: span.name,
        op: span.op,
        attributes: span.attributes,
      });
      try {
        return await fn();
      } finally {
        try {
          spanObj.end?.();
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Ignore tracing failures - never break app flow
  }

  return await fn();
}
