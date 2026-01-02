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
    public readonly retries?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export class FetchTimeoutError extends FetchError {
  constructor(
    message: string,
    public readonly timeout: number,
    correlationId?: string,
  ) {
    super(message, undefined, undefined, correlationId);
    this.name = "FetchTimeoutError";
  }
}

export class FetchNetworkError extends FetchError {
  constructor(
    message: string,
    public readonly originalError: unknown,
    correlationId?: string,
  ) {
    super(message, undefined, undefined, correlationId);
    this.name = "FetchNetworkError";
  }
}

export class FetchRateLimitError extends FetchError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    correlationId?: string,
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
 */
function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, timeout);

  // Note: The timeout will fire and abort the request if it takes too long
  // If the request completes before timeout, the abort signal will be ignored
  return controller;
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
  customShouldRetry?: (response: Response, attempt: number) => boolean,
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
  options: FetchRetryOptions = {},
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
    try {
      // Create timeout controller for this attempt
      const timeoutController = createTimeoutController(timeout);

      // Merge abort signals if both are provided
      const abortController = new AbortController();
      if (fetchOptions.signal) {
        // If original signal aborts, abort our controller
        fetchOptions.signal.addEventListener("abort", () => {
          abortController.abort();
        });
      }
      timeoutController.signal.addEventListener("abort", () => {
        abortController.abort();
      });

      // Make the fetch request
      const response = await fetch(url, {
        ...fetchOptions,
        signal: abortController.signal,
        headers: {
          ...fetchOptions.headers,
          "X-Correlation-Id": correlationId,
        },
      });

      // Check if we should retry
      if (
        shouldRetryResponse(
          response,
          attempt,
          maxRetries,
          retryOn5xx,
          customShouldRetry,
        )
      ) {
        lastResponse = response;

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retryAfterSeconds = retryAfter
            ? parseInt(retryAfter, 10)
            : undefined;

          if (attempt < maxRetries) {
            const delay = retryAfterSeconds
              ? retryAfterSeconds * 1000
              : calculateBackoffDelay(attempt, retryDelay);

            logError(
              new FetchRateLimitError(
                `Rate limited (429) on attempt ${attempt + 1}/${maxRetries + 1}`,
                retryAfterSeconds,
                correlationId,
              ),
              {
                url: String(url),
                attempt: attempt + 1,
                maxRetries: maxRetries + 1,
                delay,
                correlationId,
              },
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            throw new FetchRateLimitError(
              `Rate limited after ${maxRetries + 1} attempts`,
              retryAfterSeconds,
              correlationId,
            );
          }
        }

        // Retry on 5xx errors
        if (response.status >= 500 && response.status < 600) {
          if (attempt < maxRetries) {
            const delay = calculateBackoffDelay(attempt, retryDelay);

            logError(
              new FetchError(
                `Server error (${response.status}) on attempt ${attempt + 1}/${maxRetries + 1}`,
                response.status,
                response.statusText,
                correlationId,
                attempt + 1,
              ),
              {
                url: String(url),
                attempt: attempt + 1,
                maxRetries: maxRetries + 1,
                delay,
                correlationId,
              },
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }
      }

      // Success or non-retryable error
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt < maxRetries && retryOnNetworkError) {
          const delay = calculateBackoffDelay(attempt, retryDelay);

          logError(
            new FetchTimeoutError(
              `Request timeout after ${timeout}ms on attempt ${attempt + 1}/${maxRetries + 1}`,
              timeout,
              correlationId,
            ),
            {
              url: String(url),
              attempt: attempt + 1,
              maxRetries: maxRetries + 1,
              delay,
              correlationId,
            },
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          throw new FetchTimeoutError(
            `Request timeout after ${timeout}ms (${maxRetries + 1} attempts)`,
            timeout,
            correlationId,
          );
        }
      }

      // Handle network errors
      if (
        error instanceof TypeError ||
        (error instanceof Error &&
          (error.message.includes("fetch") ||
            error.message.includes("network") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ENOTFOUND")))
      ) {
        if (attempt < maxRetries && retryOnNetworkError) {
          const delay = calculateBackoffDelay(attempt, retryDelay);

          logError(
            new FetchNetworkError(
              `Network error on attempt ${attempt + 1}/${maxRetries + 1}: ${error.message}`,
              error,
              correlationId,
            ),
            {
              url: String(url),
              attempt: attempt + 1,
              maxRetries: maxRetries + 1,
              delay,
              correlationId,
            },
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          throw new FetchNetworkError(
            `Network error after ${maxRetries + 1} attempts: ${error.message}`,
            error,
            correlationId,
          );
        }
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
      maxRetries + 1,
    );
  }

  if (lastError) {
    throw new FetchNetworkError(
      `Request failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      lastError,
      correlationId,
    );
  }

  throw new FetchError(
    `Request failed after ${maxRetries + 1} attempts`,
    undefined,
    undefined,
    correlationId,
    maxRetries + 1,
  );
}

/**
 * Convenience wrapper for JSON requests with retry
 */
export async function fetchJsonWithRetry<T = unknown>(
  url: string | URL,
  options: FetchRetryOptions = {},
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
      options.correlationId,
    );
  }

  return response.json() as Promise<T>;
}
