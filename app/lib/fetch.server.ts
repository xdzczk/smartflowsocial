/**
 * Hardened fetch wrapper with timeouts, retries, and structured error handling
 *
 * This module provides a robust fetch wrapper that:
 * - Enforces timeouts on all requests
 * - Implements retry logic with exponential backoff
 * - Provides typed error responses
 * - Includes correlation IDs for request tracking
 * - Handles common failure modes (network errors, timeouts, rate limits)
 *
 * Usage:
 *   import { fetchWithRetry } from "~/lib/fetch.server";
 *   const response = await fetchWithRetry(url, options);
 */

import { v4 as uuidv4 } from "uuid";

import { logError } from "~/lib/error-logger.server";

/**
 * Structured error types for fetch operations
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly correlationId?: string,
    public readonly retries?: number
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export class FetchTimeoutError extends FetchError {
  constructor(
    message: string,
    public readonly timeout: number,
    correlationId?: string
  ) {
    super(message, undefined, undefined, correlationId);
    this.name = "FetchTimeoutError";
  }
}

export class FetchNetworkError extends FetchError {
  constructor(
    message: string,
    public readonly originalError: unknown,
    correlationId?: string
  ) {
    super(message, undefined, undefined, correlationId);
    this.name = "FetchNetworkError";
  }
}

export class FetchRateLimitError extends FetchError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    correlationId?: string
  ) {
    super(message, 429, "Too Many Requests", correlationId);
    this.name = "FetchRateLimitError";
  }
}

/**
 * Options for fetchWithRetry
 */
export interface FetchRetryOptions extends RequestInit {
  /**
   * Timeout in milliseconds (default: 10000)
   */
  timeout?: number;

  /**
   * Maximum number of retries (default: 2)
   */
  maxRetries?: number;

  /**
   * Base delay for exponential backoff in milliseconds (default: 1000)
   */
  retryDelay?: number;

  /**
   * Custom correlation ID (auto-generated if not provided)
   */
  correlationId?: string;

  /**
   * Whether to retry on 5xx errors (default: true)
   */
  retryOn5xx?: boolean;

  /**
   * Whether to retry on network errors (default: true)
   */
  retryOnNetworkError?: boolean;

  /**
   * Custom function to determine if a response should be retried
   */
  shouldRetry?: (response: Response, attempt: number) => boolean;
}

/**
 * Default fetch options
 */
const DEFAULT_OPTIONS: Required<
  Pick<
    FetchRetryOptions,
    | "timeout"
    | "maxRetries"
    | "retryDelay"
    | "retryOn5xx"
    | "retryOnNetworkError"
  >
> = {
  timeout: 10000, // 10 seconds
  maxRetries: 2,
  retryDelay: 1000, // 1 second base delay
  retryOn5xx: true,
  retryOnNetworkError: true,
};

/**
 * Creates an AbortController that aborts after the specified timeout
 * Returns both the controller and the timeout ID so it can be cleared
 * Also returns a flag to track if response was received
 */
function createTimeoutController(timeout: number): {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
  responseReceived: { current: boolean };
} {
  const controller = new AbortController();
  const responseReceived = { current: false };
  const timeoutId = setTimeout(() => {
    try {
      // Only abort if the signal hasn't already been aborted
      // and if we haven't received a response yet
      if (!controller.signal.aborted && !responseReceived.current) {
        controller.abort();
      }
    } catch (_error) {
      // Ignore errors when aborting (e.g., stream already has a reader)
      // This can happen if the response is already being consumed
      // The timeout has served its purpose (preventing hanging requests)
    }
  }, timeout);

  return { controller, timeoutId, responseReceived };
}

/**
 * Calculates exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Determines if a response should be retried
 */
function shouldRetryResponse(
  response: Response,
  attempt: number,
  maxRetries: number,
  retryOn5xx: boolean,
  customShouldRetry?: (response: Response, attempt: number) => boolean
): boolean {
  if (attempt >= maxRetries) {
    return false;
  }

  // Use custom retry logic if provided
  if (customShouldRetry) {
    return customShouldRetry(response, attempt);
  }

  // Retry on 5xx errors if enabled
  if (retryOn5xx && response.status >= 500 && response.status < 600) {
    return true;
  }

  // Retry on 429 (rate limit) with exponential backoff
  if (response.status === 429) {
    return true;
  }

  // Don't retry on client errors (4xx except 429)
  if (response.status >= 400 && response.status < 500) {
    return false;
  }

  // Don't retry on success
  if (response.status >= 200 && response.status < 300) {
    return false;
  }

  return false;
}

// ============================================================================
// Helper Functions for Retry Logic
// ============================================================================

/**
 * Handles retryable response status codes (429, 5xx)
 * Returns true if retry was handled and we should continue the loop
 */
async function handleRetryableResponse(
  response: Response,
  attempt: number,
  maxRetries: number,
  retryOn5xx: boolean,
  retryDelay: number,
  correlationId: string,
  url: string | URL
): Promise<boolean> {
  // Handle rate limiting
  if (response.status === 429) {
    await handleRateLimitRetry(
      response,
      attempt,
      maxRetries,
      retryDelay,
      correlationId,
      url
    );
    return true;
  }

  // Retry on 5xx errors
  if (retryOn5xx && response.status >= 500 && response.status < 600) {
    await handle5xxRetry(
      response,
      attempt,
      maxRetries,
      retryDelay,
      correlationId,
      url
    );
    return true;
  }

  return false;
}

/**
 * Handles fetch errors and determines if we should continue retrying
 * Returns true if error was handled and we should continue the loop
 */
async function handleFetchError(
  error: unknown,
  attempt: number,
  maxRetries: number,
  timeout: number,
  retryOnNetworkError: boolean,
  retryDelay: number,
  correlationId: string,
  url: string | URL
): Promise<boolean> {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Handle AbortError (timeout)
  if (errorObj.name === "AbortError") {
    await handleTimeoutError(
      errorObj,
      attempt,
      maxRetries,
      timeout,
      retryOnNetworkError,
      retryDelay,
      correlationId,
      url
    );
    return true;
  }

  // Handle network errors
  if (isNetworkError(error)) {
    await handleNetworkError(
      errorObj,
      attempt,
      maxRetries,
      retryOnNetworkError,
      retryDelay,
      correlationId,
      url
    );
    return true;
  }

  return false;
}

function createAbortControllerWithTimeout(
  timeout: number,
  originalSignal?: AbortSignal
): {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
  responseReceived: { current: boolean };
} {
  const {
    controller: timeoutController,
    timeoutId,
    responseReceived,
  } = createTimeoutController(timeout);
  const abortController = new AbortController();

  if (originalSignal) {
    originalSignal.addEventListener("abort", () => {
      try {
        if (!abortController.signal.aborted && !responseReceived.current) {
          abortController.abort();
        }
      } catch (_error) {
        // Ignore errors when aborting (e.g., stream already has a reader)
        // The abort signal has served its purpose
      }
    });
  }
  timeoutController.signal.addEventListener("abort", () => {
    try {
      if (!abortController.signal.aborted && !responseReceived.current) {
        abortController.abort();
      }
    } catch (_error) {
      // Ignore errors when aborting (e.g., stream already has a reader)
      // The timeout has served its purpose (preventing hanging requests)
    }
  });

  return { controller: abortController, timeoutId, responseReceived };
}

async function makeFetchRequest(
  url: string | URL,
  fetchOptions: RequestInit,
  correlationId: string
): Promise<Response> {
  return fetch(url, {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      "X-Correlation-Id": correlationId,
    },
  });
}

async function handleRateLimitRetry(
  response: Response,
  attempt: number,
  maxRetries: number,
  retryDelay: number,
  correlationId: string,
  url: string | URL
): Promise<number> {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;

  if (attempt < maxRetries) {
    const delay = retryAfterSeconds
      ? retryAfterSeconds * 1000
      : calculateBackoffDelay(attempt, retryDelay);

    logError(
      new FetchRateLimitError(
        `Rate limited (429) on attempt ${attempt + 1}/${maxRetries + 1}`,
        retryAfterSeconds,
        correlationId
      ),
      {
        url: String(url),
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        correlationId,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  }

  throw new FetchRateLimitError(
    `Rate limited after ${maxRetries + 1} attempts`,
    retryAfterSeconds,
    correlationId
  );
}

async function handle5xxRetry(
  response: Response,
  attempt: number,
  maxRetries: number,
  retryDelay: number,
  correlationId: string,
  url: string | URL
): Promise<void> {
  if (attempt < maxRetries) {
    const delay = calculateBackoffDelay(attempt, retryDelay);

    logError(
      new FetchError(
        `Server error (${response.status}) on attempt ${attempt + 1}/${maxRetries + 1}`,
        response.status,
        response.statusText,
        correlationId,
        attempt + 1
      ),
      {
        url: String(url),
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        correlationId,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function handleTimeoutError(
  error: Error,
  attempt: number,
  maxRetries: number,
  timeout: number,
  retryOnNetworkError: boolean,
  retryDelay: number,
  correlationId: string,
  url: string | URL
): Promise<void> {
  if (attempt < maxRetries && retryOnNetworkError) {
    const delay = calculateBackoffDelay(attempt, retryDelay);

    logError(
      new FetchTimeoutError(
        `Request timeout after ${timeout}ms on attempt ${attempt + 1}/${maxRetries + 1}`,
        timeout,
        correlationId
      ),
      {
        url: String(url),
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        correlationId,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
  } else {
    throw new FetchTimeoutError(
      `Request timeout after ${timeout}ms (${maxRetries + 1} attempts)`,
      timeout,
      correlationId
    );
  }
}

async function handleNetworkError(
  error: Error,
  attempt: number,
  maxRetries: number,
  retryOnNetworkError: boolean,
  retryDelay: number,
  correlationId: string,
  url: string | URL
): Promise<void> {
  if (attempt < maxRetries && retryOnNetworkError) {
    const delay = calculateBackoffDelay(attempt, retryDelay);

    logError(
      new FetchNetworkError(
        `Network error on attempt ${attempt + 1}/${maxRetries + 1}: ${error.message}`,
        error,
        correlationId
      ),
      {
        url: String(url),
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        correlationId,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
  } else {
    throw new FetchNetworkError(
      `Network error after ${maxRetries + 1} attempts: ${error.message}`,
      error,
      correlationId
    );
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound")
    );
  }
  return false;
}

/**
 * Hardened fetch with timeout, retries, and structured error handling
 *
 * @param url - The URL to fetch
 * @param options - Fetch options including retry configuration
 * @returns Promise resolving to Response
 * @throws FetchError, FetchTimeoutError, FetchNetworkError, or FetchRateLimitError
 */
export async function fetchWithRetry(
  url: string | URL,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_OPTIONS.timeout,
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    retryDelay = DEFAULT_OPTIONS.retryDelay,
    retryOn5xx = DEFAULT_OPTIONS.retryOn5xx,
    retryOnNetworkError = DEFAULT_OPTIONS.retryOnNetworkError,
    correlationId = uuidv4(),
    shouldRetry: customShouldRetry,
    ...fetchOptions
  } = options;

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutId: NodeJS.Timeout | undefined;
    let responseReceived: { current: boolean } | undefined;
    try {
      // Create abort controller with timeout
      const {
        controller: abortController,
        timeoutId: tid,
        responseReceived: rr,
      } = createAbortControllerWithTimeout(
        timeout,
        fetchOptions.signal ?? undefined
      );
      timeoutId = tid;
      responseReceived = rr;

      // Make the fetch request
      const response = await makeFetchRequest(
        url,
        { ...fetchOptions, signal: abortController.signal },
        correlationId
      );

      // Mark that we've received a response
      // This prevents the timeout from trying to abort a stream that's being consumed
      if (responseReceived) {
        responseReceived.current = true;
      }

      // Clear the timeout since we got a response
      // This prevents the timeout from firing and trying to abort
      // a stream that might already be locked (e.g., when response.json() is called)
      clearTimeout(timeoutId);

      // Check if we should retry this response
      if (
        shouldRetryResponse(
          response,
          attempt,
          maxRetries,
          retryOn5xx,
          customShouldRetry
        )
      ) {
        lastResponse = response;

        // Handle retryable responses (429, 5xx)
        const shouldContinue = await handleRetryableResponse(
          response,
          attempt,
          maxRetries,
          retryOn5xx,
          retryDelay,
          correlationId,
          url
        );

        if (shouldContinue) {
          continue;
        }
      }

      // Success or non-retryable error
      return response;
    } catch (error) {
      // Clear timeout on error to prevent it from firing later
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle retryable errors (timeout, network)
      const shouldContinue = await handleFetchError(
        error,
        attempt,
        maxRetries,
        timeout,
        retryOnNetworkError,
        retryDelay,
        correlationId,
        url
      );

      if (shouldContinue) {
        continue;
      }

      // Re-throw unknown errors
      throw error;
    }
  }

  // If we get here, we've exhausted retries
  if (lastResponse) {
    throw new FetchError(
      `Request failed after ${maxRetries + 1} attempts with status ${lastResponse.status}`,
      lastResponse.status,
      lastResponse.statusText,
      correlationId,
      maxRetries + 1
    );
  }

  if (lastError) {
    throw new FetchNetworkError(
      `Request failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      lastError,
      correlationId
    );
  }

  throw new FetchError(
    `Request failed after ${maxRetries + 1} attempts`,
    undefined,
    undefined,
    correlationId,
    maxRetries + 1
  );
}

/**
 * Convenience wrapper for JSON requests with retry
 */
export async function fetchJsonWithRetry<T = unknown>(
  url: string | URL,
  options: FetchRetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new FetchError(
      `JSON request failed with status ${response.status}`,
      response.status,
      response.statusText,
      options.correlationId
    );
  }

  return response.json() as Promise<T>;
}
