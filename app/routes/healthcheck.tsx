// learn more: https://fly.io/docs/reference/configuration/#services-http_checks
import type { LoaderFunctionArgs } from "@remix-run/node";

import { countUsers } from "~/models/user.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const host =
      request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

    if (!host) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Missing host header");
    }

    const url = new URL("/", `http://${host}`);
    // if we can connect to the database and make a simple query
    // and make a HEAD request to ourselves, then we're good.
    await Promise.all([
      countUsers(),
      fetch(url.toString(), { method: "HEAD" }).then((r) => {
        if (!r.ok) return Promise.reject(r);
      }),
    ]);
    return new Response("OK");
  } catch (error) {
    // For healthcheck, we want to return 500 but still use centralized error handling
    const { ExternalServiceError, DatabaseError } = await import("~/lib/errors");
    const { logError } = await import("~/lib/error-logger.server");
    
    // Determine error type
    const normalizedError = error instanceof Error && error.message.includes("database")
      ? new DatabaseError("Health check failed: Database connection error", {
          originalError: error instanceof Error ? error.message : String(error),
        })
      : new ExternalServiceError("Health check failed", 503, {
          service: "HealthCheck",
          originalError: error instanceof Error ? error.message : String(error),
        });
    
    logError(normalizedError, { path: request.url });
    return new Response("ERROR", { status: 500 });
  }
};

