/**
 * Correlation ID tracking for signer flows
 * Tracks context through signer redirects to resume operations on return
 */

interface CorrelationContext {
  correlationId: string;
  postId?: string;
  action: "publish" | "schedule" | "sign";
  timestamp: number;
  route?: string;
}

const STORAGE_KEY = "pwa-correlation-context";
const CORRELATION_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store correlation context before signer redirect
 */
export function storeCorrelationContext(
  context: Omit<CorrelationContext, "timestamp">
): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    const fullContext: CorrelationContext = {
      ...context,
      timestamp: Date.now(),
      route: window.location.pathname,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fullContext));
  } catch (error) {
    console.warn("Failed to store correlation context:", error);
  }
}

/**
 * Get and clear correlation context (one-time use)
 */
export function getAndClearCorrelationContext(): CorrelationContext | null {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const context = JSON.parse(stored) as CorrelationContext;

    // Check if context is expired
    if (Date.now() - context.timestamp > CORRELATION_TTL) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Clear after reading (one-time use)
    sessionStorage.removeItem(STORAGE_KEY);
    return context;
  } catch (error) {
    console.warn("Failed to get correlation context:", error);
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Check if there's a pending correlation context
 */
export function hasPendingCorrelation(): boolean {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return false;
    }
    const context = JSON.parse(stored) as CorrelationContext;
    return Date.now() - context.timestamp <= CORRELATION_TTL;
  } catch {
    return false;
  }
}

/**
 * Clear correlation context (cleanup)
 */
export function clearCorrelationContext(): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear correlation context:", error);
  }
}
