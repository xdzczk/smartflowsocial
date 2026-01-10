/**
 * CSRF Protection Middleware
 *
 * This file contains the implementation that works in both server and client bundles.
 * The server file re-exports from here to maintain backward compatibility.
 *
 * Usage:
 *   import { withCSRFProtection } from "~/lib/csrf";
 *   export const action = withCSRFProtection(async ({ request }) => {
 *     // Your action code
 *   });
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// Cache for server-only functions (loaded dynamically on server)
let serverFunctions: {
  isStateChangingMethod: (method: string) => boolean;
  validateOrigin: (request: Request) => void;
} | null = null;

// Lazy load server-only functions to avoid client bundling issues
async function getServerFunctions() {
  if (typeof window !== "undefined") {
    // Client-side: should never be called, but provide a stub
    throw new Error("CSRF protection is server-only");
  }

  if (!serverFunctions) {
    // Server-side: dynamically import the real implementations
    // This avoids bundling issues and works in both ESM and CJS contexts
    const security = await import("./security.server");
    serverFunctions = {
      isStateChangingMethod: security.isStateChangingMethod,
      validateOrigin: security.validateOrigin,
    };
  }
  return serverFunctions;
}

/**
 * Wraps action functions with CSRF protection
 *
 * This middleware validates the Origin/Referer header for state-changing requests
 * (POST, PUT, PATCH, DELETE) to prevent CSRF attacks.
 *
 * @param actionFn - The action function to protect
 * @returns A protected action function
 */
export function withCSRFProtection<T>(
  actionFn: (args: ActionFunctionArgs) => Promise<T>
): (args: ActionFunctionArgs) => Promise<T | Response> {
  return async (args: ActionFunctionArgs) => {
    // On the client, this should never be called (actions are server-only)
    // But we provide a stub to satisfy the bundler
    if (typeof window !== "undefined") {
      throw new Error(
        "withCSRFProtection should never be called on the client"
      );
    }

    const { isStateChangingMethod, validateOrigin } =
      await getServerFunctions();
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
            message: error instanceof Error ? error.message : "Invalid origin",
          },
          { status: 403 }
        );
      }
    }

    // Proceed with the action
    return actionFn(args);
  };
}
