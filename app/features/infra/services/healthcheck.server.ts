/**
 * Healthcheck service layer
 * Handles application health checks
 */

import { countUsers } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { DatabaseError, ExternalServiceError, ValidationError } from "~/lib/errors";
/**
 * Perform health check
 * Verifies database connectivity and HTTP service availability
 */
export async function performHealthCheck(host: string | null) {
  if (!host) {
    throw new ValidationError("Missing host header");
  }

  const url = new URL("/", `http://${host}`);
  
  // if we can connect to the database and make a simple query
  // and make a HEAD request to ourselves, then we're good.
  await Promise.all([
    countUsers(),
    (async () => {
      const r = await fetch(url.toString(), { method: "HEAD" });
      if (!r.ok) return Promise.reject(r);
    })(),
  ]);
  
  return new Response("OK");
}

/**
 * Handle health check errors
 */
export function handleHealthCheckError(error: unknown, requestUrl: string) {
  // Determine error type
  const normalizedError = error instanceof Error && error.message.includes("database")
    ? new DatabaseError("Health check failed: Database connection error", {
        originalError: error instanceof Error ? error.message : String(error),
      })
    : new ExternalServiceError("Health check failed", 503, {
        service: "HealthCheck",
        originalError: error instanceof Error ? error.message : String(error),
      });
  
  logError(normalizedError, { path: requestUrl });
  return new Response("ERROR", { status: 500 });
}

