/**
 * Security utilities for CSRF protection and request validation
 *
 * This module provides utilities for validating request origins and protecting
 * against CSRF attacks.
 */

import { env } from "./env.server";

/**
 * CSRF validation error
 */
export class CSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CSRFValidationError";
  }
}

/**
 * Validates Origin header for CSRF protection
 *
 * @param request - The incoming request
 * @throws {CSRFValidationError} If origin validation fails
 */
export function validateOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");

  // Allow same-origin requests (no Origin header)
  // This handles same-origin form submissions and navigation
  if (!origin && !referer) {
    return; // Same-origin request, allow it
  }

  // Get allowed origins from env
  const allowedOrigins: string[] = [];
  
  // Add APP_URL if set
  if (env.APP_URL) {
    try {
      const appUrl = new URL(env.APP_URL);
      allowedOrigins.push(appUrl.origin);
    } catch (_error) {
      console.warn("Invalid APP_URL in environment:", env.APP_URL);
    }
  }

  // Add ALLOWED_ORIGINS if set (comma-separated)
  if (env.ALLOWED_ORIGINS) {
    const origins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    for (const originStr of origins) {
      try {
        const originUrl = new URL(originStr);
        allowedOrigins.push(originUrl.origin);
      } catch (_error) {
        console.warn("Invalid origin in ALLOWED_ORIGINS:", originStr);
      }
    }
  }

  // If no allowed origins configured, default to same-origin only
  // In development, allow localhost origins
  const isDevelopment = env.NODE_ENV === "development";
  if (allowedOrigins.length === 0 && !isDevelopment) {
    // In production without configuration, only allow same-origin
    // This is strict but safe
    if (origin || referer) {
      throw new CSRFValidationError(
        "CSRF protection enabled but no allowed origins configured"
      );
    }
    return;
  }

  // In development, add localhost origins
  if (isDevelopment) {
    allowedOrigins.push("http://localhost:3000");
    allowedOrigins.push("http://127.0.0.1:3000");
  }

  // Validate Origin if present (preferred header)
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const isValid = allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          return originUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });

      if (!isValid) {
        throw new CSRFValidationError(
          `Invalid origin: ${origin}. Allowed origins: ${allowedOrigins.join(", ")}`
        );
      }
      return; // Origin is valid
    } catch (error) {
      if (error instanceof CSRFValidationError) {
        throw error;
      }
      throw new CSRFValidationError(`Invalid origin header format: ${origin}`);
    }
  }

  // Fallback to Referer if Origin not present (some browsers don't send Origin for same-origin)
  if (!origin && referer) {
    try {
      const refererUrl = new URL(referer);
      const isValid = allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          return refererUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });

      if (!isValid) {
        throw new CSRFValidationError(
          `Invalid referer: ${referer}. Allowed origins: ${allowedOrigins.join(", ")}`
        );
      }
      return; // Referer is valid
    } catch (error) {
      if (error instanceof CSRFValidationError) {
        throw error;
      }
      throw new CSRFValidationError(`Invalid referer header format: ${referer}`);
    }
  }
}

/**
 * Checks if a request method is state-changing
 */
export function isStateChangingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

