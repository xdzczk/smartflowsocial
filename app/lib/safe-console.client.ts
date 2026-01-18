/**
 * Safe client-side console helpers.
 *
 * We keep direct console usage centralized here so app code can avoid ad-hoc
 * `console.*` calls while still providing last-resort logging when telemetry
 * (e.g., Sentry) isn't available.
 */

export function safeConsoleError(...args: unknown[]): void {
  try {
    console.error(...args);
  } catch {
    // ignore
  }
}

export function safeConsoleWarn(...args: unknown[]): void {
  try {
    console.warn(...args);
  } catch {
    // ignore
  }
}

export function safeConsoleInfo(...args: unknown[]): void {
  try {
    console.info(...args);
  } catch {
    // ignore
  }
}
