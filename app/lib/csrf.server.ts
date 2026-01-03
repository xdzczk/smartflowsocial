/**
 * CSRF Protection Middleware
 *
 * Provides a wrapper function for Remix action handlers to add CSRF protection
 * via Origin/Referer header validation.
 *
 * Usage:
 *   export const action = withCSRFProtection(async ({ request }) => {
 *     // Your action code
 *   });
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { isStateChangingMethod, validateOrigin } from "./security.server";

/**
 * Wraps action functions with CSRF protection
 *
 * This middleware validates the Origin/Referer header for state-changing requests
 * (POST, PUT, PATCH, DELETE) to prevent CSRF attacks.
 *
 * @param actionFn - The action function to protect
 * @returns A protected action function
 *
 * @example
 * ```typescript
 * export const action = withCSRFProtection(async ({ request }) => {
 *   const userId = await requireUserId(request);
 *   // ... your action logic
 * });
 * ```
 */
export function withCSRFProtection<T>(
  actionFn: (args: ActionFunctionArgs) => Promise<T>
) {
  return async (args: ActionFunctionArgs) => {
    const method = args.request.method;

    // Only protect state-changing methods
    if (isStateChangingMethod(method)) {
      try {
        validateOrigin(args.request);
      } catch (error) {
        // Return 403 Forbidden for CSRF validation failures
        return json(
          {
            error: "CSRF validation failed",
            message:
              error instanceof Error ? error.message : "Invalid origin",
          },
          { status: 403 }
        );
      }
    }

    // Proceed with the action
    return actionFn(args);
  };
}

