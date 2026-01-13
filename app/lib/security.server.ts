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
// ============================================================================
// Helper Functions
// ============================================================================

function addAppUrlToAllowedOrigins(allowedOrigins: string[]): void {
  // Try APP_URL first
  if (env.APP_URL) {
    try {
      const appUrl = new URL(env.APP_URL);
      allowedOrigins.push(appUrl.origin);
      return;
    } catch {
      console.warn("Invalid APP_URL in environment:", env.APP_URL);
    }
  }

  // Fallback to COOLIFY_URL if APP_URL is not set
  const coolifyUrl = process.env["COOLIFY_URL"];
  if (coolifyUrl) {
    try {
      const url = new URL(coolifyUrl);
      allowedOrigins.push(url.origin);
    } catch {
      console.warn("Invalid COOLIFY_URL in environment:", coolifyUrl);
    }
  }
}

function addAllowedOriginsFromEnv(allowedOrigins: string[]): void {
  if (!env.ALLOWED_ORIGINS) {
    return;
  }
  const origins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  for (const originStr of origins) {
    try {
      const originUrl = new URL(originStr);
      allowedOrigins.push(originUrl.origin);
    } catch {
      console.warn("Invalid origin in ALLOWED_ORIGINS:", originStr);
    }
  }
}

function addDevelopmentOrigins(allowedOrigins: string[]): void {
  if (env.NODE_ENV === "development") {
    allowedOrigins.push("http://localhost:3000");
    allowedOrigins.push("http://127.0.0.1:3000");
  }
}

function buildAllowedOrigins(): string[] {
  const allowedOrigins: string[] = [];
  addAppUrlToAllowedOrigins(allowedOrigins);
  addAllowedOriginsFromEnv(allowedOrigins);
  addDevelopmentOrigins(allowedOrigins);
  return allowedOrigins;
}

function checkSameOriginRequest(
  origin: string | null,
  referer: string | null
): boolean {
  return !origin && !referer;
}

function validateOriginHeader(origin: string, allowedOrigins: string[]): void {
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
  } catch (error) {
    if (error instanceof CSRFValidationError) {
      throw error;
    }
    throw new CSRFValidationError(`Invalid origin header format: ${origin}`);
  }
}

function validateRefererHeader(
  referer: string,
  allowedOrigins: string[]
): void {
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
  } catch (error) {
    if (error instanceof CSRFValidationError) {
      throw error;
    }
    throw new CSRFValidationError(`Invalid referer header format: ${referer}`);
  }
}

function checkProductionStrictMode(
  origin: string | null,
  referer: string | null,
  allowedOrigins: string[]
): void {
  const isDevelopment = env.NODE_ENV === "development";
  if (allowedOrigins.length === 0 && !isDevelopment) {
    if (origin || referer) {
      throw new CSRFValidationError(
        "CSRF protection enabled but no allowed origins configured"
      );
    }
  }
}

export function validateOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");

  if (checkSameOriginRequest(origin, referer)) {
    return;
  }

  const allowedOrigins = buildAllowedOrigins();
  checkProductionStrictMode(origin, referer, allowedOrigins);

  if (origin) {
    validateOriginHeader(origin, allowedOrigins);
    return;
  }

  if (referer) {
    validateRefererHeader(referer, allowedOrigins);
  }
}

/**
 * Checks if a request method is state-changing
 */
export function isStateChangingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}
