/**
 * Server-side Error Handling Utilities
 *
 * Provides utilities for handling errors in Remix loaders and actions
 *
 * NOTE: This module must be imported/initialized before routes use it.
 * The bundler uses lazy ESM initialization, so we ensure functions are
 * defined immediately to avoid timing issues.
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { logError } from "./error-logger.server";
import {
  AuthenticationError,
  AuthorizationError,
  getUserFriendlyMessage,
  normalizeError,
  NotFoundError,
  ValidationError,
} from "./errors";

// Force immediate evaluation by defining functions before exports
// This ensures they're available when the export getter is called

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard API response type
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  options?: {
    includeStack?: boolean;
    includeContext?: boolean;
  },
): [ErrorResponse, number] {
  const normalizedError = normalizeError(error);
  const includeStack =
    options?.includeStack ?? process.env.NODE_ENV === "development";
  const includeContext = options?.includeContext ?? true;

  // Log the error
  logError(normalizedError, {
    includeStack,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      message: getUserFriendlyMessage(normalizedError),
      code: normalizedError.code,
      statusCode: normalizedError.statusCode,
      timestamp: normalizedError.timestamp,
      ...(includeContext &&
        normalizedError.context && {
          context: normalizedError.context,
        }),
      ...(includeStack &&
        normalizedError.stack && {
          stack: normalizedError.stack,
        }),
    },
  };

  return [response, normalizedError.statusCode];
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Wrapper for Remix loaders with automatic error handling
 * Using export function (not const) to match pattern used by other server utilities
 * that work correctly with Remix bundler (e.g., requireUserId, requireFeatureAccess)
 */
export function withErrorHandling<T>(
  loaderFn: (args: LoaderFunctionArgs) => Promise<T>,
) {
  return async (args: LoaderFunctionArgs) => {
    try {
      const result = await loaderFn(args);
      // If result is already a Response (e.g., redirect), return it as-is
      if (result instanceof Response) {
        return result;
      }
      return json(result);
    } catch (error) {
      // If error is a Response (e.g., redirect from requireUserId), return it
      // In Remix runtime, thrown Responses are caught and used as the response
      // In tests, we need to return it so we can assert on it
      if (error instanceof Response) {
        return error;
      }
      const [errorResponse, statusCode] = createErrorResponse(error);
      return json(errorResponse, { status: statusCode });
    }
  };
}

/**
 * Wrapper for Remix actions with automatic error handling
 * Using export function (not const) to match pattern used by other server utilities
 * that work correctly with Remix bundler (e.g., requireUserId, requireFeatureAccess)
 */
export function withActionErrorHandling<T>(
  actionFn: (args: ActionFunctionArgs) => Promise<T>,
) {
  return async (args: ActionFunctionArgs) => {
    try {
      const result = await actionFn(args);
      // If result is already a Response (e.g., redirect), return it as-is
      if (result instanceof Response) {
        return result;
      }
      return json(result);
    } catch (error) {
      // If error is a Response (e.g., redirect from requireUserId), return it
      // In Remix runtime, thrown Responses are caught and used as the response
      // In tests, we need to return it so we can assert on it
      if (error instanceof Response) {
        return error;
      }
      const [errorResponse, statusCode] = createErrorResponse(error);
      return json(errorResponse, { status: statusCode });
    }
  };
}

/**
 * Handle errors in loaders - returns safe default data
 */
export function handleLoaderError(
  error: unknown,
  defaultData: unknown,
): Response {
  const [errorResponse, statusCode] = createErrorResponse(error);
  const defaultDataObj =
    defaultData && typeof defaultData === "object" ? defaultData : {};
  return json(
    {
      ...defaultDataObj,
      error: errorResponse.error,
    },
    { status: statusCode },
  );
}

/**
 * Handle errors in actions - returns error response
 */
export function handleActionError(error: unknown): Response {
  const [errorResponse, statusCode] = createErrorResponse(error);
  return json(errorResponse, { status: statusCode });
}

/**
 * Assert a condition, throwing a ValidationError if false
 */
export function assert(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    throw new ValidationError(message, context);
  }
}

/**
 * Assert a value exists, throwing a NotFoundError if null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  message = "Resource not found",
  context?: Record<string, unknown>,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(message, context);
  }
}

/**
 * Assert user is authenticated
 */
export function assertAuthenticated(
  userId: string | undefined | null,
  message = "Authentication required",
): asserts userId is string {
  if (!userId) {
    throw new AuthenticationError(message);
  }
}

/**
 * Assert user has permission
 */
export function assertAuthorized(
  hasPermission: boolean,
  message = "Insufficient permissions",
  context?: Record<string, unknown>,
): asserts hasPermission {
  if (!hasPermission) {
    throw new AuthorizationError(message, context);
  }
}
