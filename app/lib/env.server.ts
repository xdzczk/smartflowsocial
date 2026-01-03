/**
 * Centralized environment variable validation and typed exports
 *
 * This module validates all environment variables at boot time and exports
 * a typed object that can be safely used throughout the application.
 *
 * Usage:
 *   import { env } from "~/lib/env.server";
 *   const url = env.NOSTR_PUBLISHER_URL; // Type-safe, guaranteed to exist
 */

interface EnvConfig {
  // Required
  DATABASE_URL: string;
  SESSION_SECRET: string;
  NOSTR_PUBLISHER_URL: string;
  REDIS_URL: string;

  // Storage (required if any storage var is set)
  STORAGE_ACCESS_KEY?: string;
  STORAGE_SECRET?: string;
  STORAGE_REGION?: string;
  STORAGE_BUCKET?: string;

  // Optional
  PRIMAL_CACHING_URL?: string;
  OWNER_NWC?: string;
  NOSTR_NSEC?: string;
  SENTRY_DSN?: string;
  NODE_ENV?: string;
  PORT?: string;
  METRICS_PORT?: string;
  FLY_REGION?: string;
  PRIMARY_REGION?: string;
  TEST_DATABASE_URL?: string;
  ENABLE_SOURCE_MAPS?: string;
  E2E_TEST?: string;
  
  // Security (CSRF protection)
  APP_URL?: string; // Canonical app URL (e.g., https://yourdomain.com)
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins for CSRF protection
  
  // Metrics endpoint security
  METRICS_TOKEN?: string; // Token required to access /metrics endpoint
  METRICS_ALLOWED_IPS?: string; // Comma-separated list of allowed IPs for metrics endpoint
}

interface ValidationError {
  key: string;
  reason: string;
}

/**
 * Validates environment variables and returns typed config
 * Throws error if validation fails (prevents app from starting)
 */
function validateAndGetEnv(): EnvConfig {
  // Provide default values for E2E tests if variables are not set
  if (process.env.E2E_TEST === "true") {
    process.env.DATABASE_URL ??=
      process.env.TEST_DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/smartflow_test";
    process.env.SESSION_SECRET ??=
      "test-session-secret-very-long-and-secure-32-chars-minimum";
    process.env.NOSTR_PUBLISHER_URL ??= "http://localhost:3001/publish";
    process.env.REDIS_URL ??= "redis://localhost:6379";
  }

  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "NOSTR_PUBLISHER_URL",
    "REDIS_URL",
  ] as const;

  // Storage variables are optional - only required if using image uploads
  // If any storage variable is set, all must be set
  const storageVariables = [
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET",
    "STORAGE_REGION",
    "STORAGE_BUCKET",
  ] as const;

  const missing: string[] = [];
  const invalid: ValidationError[] = [];

  // Validate required variables
  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    } else {
      // Additional validation for specific variables
      if (key === "SESSION_SECRET" && value.length < 32) {
        invalid.push({
          key,
          reason: "must be at least 32 characters long",
        });
      }
      if (key === "DATABASE_URL" && !value.startsWith("postgresql://")) {
        invalid.push({
          key,
          reason:
            "must be a valid PostgreSQL connection string (postgresql://...)",
        });
      }
      if (key === "REDIS_URL" && !value.startsWith("redis://")) {
        invalid.push({
          key,
          reason: "must be a valid Redis connection string (redis://...)",
        });
      }
    }
  }

  // Validate storage variables: if any is set, all must be set
  const storageValues = storageVariables.map((key) => process.env[key]);
  const hasSomeStorage = storageValues.some((v) => v && v.trim() !== "");
  const hasAllStorage = storageValues.every((v) => v && v.trim() !== "");

  if (hasSomeStorage && !hasAllStorage) {
    missing.push(
      ...storageVariables.filter((key) => {
        const value = process.env[key];
        return !value || value.trim() === "";
      }),
    );
  }

  // Report errors
  if (missing.length > 0 || invalid.length > 0) {
    console.error("❌ Environment validation failed:");

    if (missing.length > 0) {
      console.error("\nMissing required environment variables:");
      missing.forEach((key) => console.error(`  - ${key}`));
    }

    if (invalid.length > 0) {
      console.error("\nInvalid environment variables:");
      invalid.forEach(({ key, reason }) =>
        console.error(`  - ${key}: ${reason}`),
      );
    }

    console.error(
      "\nPlease check your .env file or environment configuration.",
    );
    console.error(
      "See docs/getting-started/environment-setup.md for detailed configuration instructions.",
    );

    process.exit(1);
  }

  // Build typed config object
  const config: EnvConfig = {
    DATABASE_URL: process.env.DATABASE_URL!,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    NOSTR_PUBLISHER_URL: process.env.NOSTR_PUBLISHER_URL!,
    REDIS_URL: process.env.REDIS_URL!,
  };

  // Add optional storage config if all are set
  if (hasAllStorage) {
    config.STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;
    config.STORAGE_SECRET = process.env.STORAGE_SECRET;
    config.STORAGE_REGION = process.env.STORAGE_REGION;
    config.STORAGE_BUCKET = process.env.STORAGE_BUCKET;
  }

  // Add other optional variables
  if (process.env.PRIMAL_CACHING_URL) {
    config.PRIMAL_CACHING_URL = process.env.PRIMAL_CACHING_URL;
  }
  if (process.env.OWNER_NWC) {
    config.OWNER_NWC = process.env.OWNER_NWC;
  }
  if (process.env.NOSTR_NSEC) {
    config.NOSTR_NSEC = process.env.NOSTR_NSEC;
  }
  if (process.env.SENTRY_DSN) {
    config.SENTRY_DSN = process.env.SENTRY_DSN;
  }
  if (process.env.NODE_ENV) {
    config.NODE_ENV = process.env.NODE_ENV;
  }
  if (process.env.PORT) {
    config.PORT = process.env.PORT;
  }
  if (process.env.METRICS_PORT) {
    config.METRICS_PORT = process.env.METRICS_PORT;
  }
  if (process.env.FLY_REGION) {
    config.FLY_REGION = process.env.FLY_REGION;
  }
  if (process.env.PRIMARY_REGION) {
    config.PRIMARY_REGION = process.env.PRIMARY_REGION;
  }
  if (process.env.TEST_DATABASE_URL) {
    config.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  if (process.env.ENABLE_SOURCE_MAPS) {
    config.ENABLE_SOURCE_MAPS = process.env.ENABLE_SOURCE_MAPS;
  }
  if (process.env.E2E_TEST) {
    config.E2E_TEST = process.env.E2E_TEST;
  }
  
  // Add security configuration
  if (process.env.APP_URL) {
    config.APP_URL = process.env.APP_URL;
  }
  if (process.env.ALLOWED_ORIGINS) {
    config.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
  }
  if (process.env.METRICS_TOKEN) {
    config.METRICS_TOKEN = process.env.METRICS_TOKEN;
  }
  if (process.env.METRICS_ALLOWED_IPS) {
    config.METRICS_ALLOWED_IPS = process.env.METRICS_ALLOWED_IPS;
  }

  console.info("✅ Environment variables validated");
  return config;
}

// Validate and export typed environment config
// This runs at module load time, so validation happens before app starts
export const env = validateAndGetEnv();

// Export type for use in other modules
export type { EnvConfig };
