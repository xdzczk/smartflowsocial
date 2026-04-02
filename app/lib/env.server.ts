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

import {
  safeConsoleError,
  safeConsoleLog,
} from "~/lib/secrets-sanitizer.server";

interface EnvConfig {
  // Required
  DATABASE_URL: string;
  SESSION_SECRET: string;
  NOSTR_PUBLISHER_URL: string;
  NOSTR_PUBLISHER_API_TOKEN?: string; // Optional API token for publisher authentication
  REDIS_URL: string;

  // Storage (required if any storage var is set)
  STORAGE_ACCESS_KEY?: string;
  STORAGE_SECRET?: string;
  STORAGE_REGION?: string;
  STORAGE_BUCKET?: string;
  STORAGE_CDN_URL?: string;

  // Optional
  PRIMAL_CACHING_URL?: string;
  /** HTTP Primal proxy: per-attempt timeout ms (default 8000). */
  PRIMAL_HTTP_TIMEOUT_MS?: string;
  /** HTTP Primal proxy: extra retries after first attempt (default 0). */
  PRIMAL_HTTP_MAX_RETRIES?: string;
  OWNER_NWC?: string;
  OWNER_NWC_RELAY?: string;
  OWNER_NWC_RELAYS?: string;
  NOSTR_NSEC?: string;
  /** npub (or hex) of the inbox that receives in-app bug/feature feedback via server-signed DMs */
  FEEDBACK_INBOX_NPUB?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  SENTRY_PROFILES_SAMPLE_RATE?: string;
  RELAY_HEALTH_STORE?: string; // "memory" | "redis" (optional)
  NODE_ENV?: string;
  PORT?: string;
  HOST?: string; // Listen host (e.g. 0.0.0.0 for Docker)
  DISABLE_RATE_LIMIT?: string; // "true" to disable (e.g. E2E)
  METRICS_PORT?: string;
  WORKER_METRICS_PORT?: string;
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

  // Feature flags
  // NOTE: These are optional and are parsed as booleans by feature-flags.server.ts
  NOSTR_AUTH_V2_ENABLED?: string; // Enable /auth/nostr/challenge + /auth/nostr/verify
  ENFORCE_NOSTR_SESSION_PUBKEY?: string; // Enforce session pubkey === signed event pubkey
  MEDIA_PIPELINE_V2_ENABLED?: string; // Enable unified media intents/commit pipeline
  ENABLE_NOSTR_DELETE_EVENTS?: string; // Enable async kind:5 relay deletion events
  NOSTR_DM_NIP17_ENABLED?: string; // When true (default), send NIP-17 gift-wrapped DMs when recipient has kind:10050 inbox relays
  /** When true, NIP-88 poll composer, voting, and tallies are enabled (default off). */
  NIP88_POLLS_ENABLED?: string;
  /** When true, Contests v1 UI and server routes are enabled. */
  CONTESTS_V1_ENABLED?: string;
  /** When true, use dual-lane subscription checkout (auto-renew + one-time). */
  SUBSCRIPTION_CHECKOUT_V2_ENABLED?: string;

  /** BTCPay Greenfield (Founder on-chain); all three required to enable checkout. */
  BTCPAY_URL?: string;
  BTCPAY_API_KEY?: string;
  BTCPAY_STORE_ID?: string;
  /** Webhook HMAC secret from BTCPay (Settings → Webhooks). */
  BTCPAY_WEBHOOK_SECRET?: string;

  // Blossom (vibe-cdn) internal API: secret for subscription-status gating
  BLOSSOM_INTERNAL_SECRET?: string;
  BLOSSOM_SFS_API_URL?: string;
  BLOSSOM_UPLOAD_TOKEN_SECRET?: string;

  // SFS Blastr: admin API for entitlement and policy sync (optional; no-op when unset)
  BLASTR_ADMIN_URL?: string;
  BLASTR_ADMIN_API_TOKEN?: string;

  // Referral
  REFERRAL_LANDING_URL?: string;
  REFERRAL_MANUAL_PAYOUT_SECRET?: string;

  // Operator admin (/dashboard/admin*)
  ADMIN_NPUBS?: string;

  // Web Push (VAPID)
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;

  // Ops / tooling
  COOLIFY_URL?: string;
  CYPRESS?: string; // Set by Cypress when running E2E (rate-limit bypass)
}

interface ValidationError {
  key: string;
  reason: string;
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

function validateRequiredVariable(
  key: string,
  value: string | undefined
): ValidationError | null {
  if (!value || value.trim() === "") {
    return null; // Missing, handled separately
  }

  if (key === "SESSION_SECRET" && value.length < 32) {
    return {
      key,
      reason: "must be at least 32 characters long",
    };
  }
  if (
    key === "DATABASE_URL" &&
    !value.startsWith("postgresql://") &&
    !value.startsWith("postgres://")
  ) {
    return {
      key,
      reason:
        "must be a valid PostgreSQL connection string (postgresql://... or postgres://...)",
    };
  }
  if (key === "REDIS_URL" && !value.startsWith("redis://")) {
    return {
      key,
      reason: "must be a valid Redis connection string (redis://...)",
    };
  }

  return null;
}

function validateStorageVariables(
  storageVariables: readonly string[]
): string[] {
  const storageValues = storageVariables.map((key) => process.env[key]);
  const hasSomeStorage = storageValues.some((v) => v && v.trim() !== "");
  const hasAllStorage = storageValues.every((v) => v && v.trim() !== "");

  if (hasSomeStorage && !hasAllStorage) {
    return storageVariables.filter((key) => {
      const value = process.env[key];
      return !value || value.trim() === "";
    });
  }

  return [];
}

function buildBaseConfig(): EnvConfig {
  return {
    DATABASE_URL: process.env["DATABASE_URL"]!,
    SESSION_SECRET: process.env["SESSION_SECRET"]!,
    NOSTR_PUBLISHER_URL: process.env["NOSTR_PUBLISHER_URL"]!,
    REDIS_URL: process.env["REDIS_URL"]!,
  };
}

function addOptionalStorageConfig(
  config: EnvConfig,
  hasAllStorage: boolean
): void {
  if (hasAllStorage) {
    config.STORAGE_ACCESS_KEY = process.env["STORAGE_ACCESS_KEY"];
    config.STORAGE_SECRET = process.env["STORAGE_SECRET"];
    config.STORAGE_REGION = process.env["STORAGE_REGION"];
    config.STORAGE_BUCKET = process.env["STORAGE_BUCKET"];
  }
}

function addOptionalConfig(config: EnvConfig): void {
  const optionalVars: Array<keyof EnvConfig> = [
    "PRIMAL_CACHING_URL",
    "PRIMAL_HTTP_TIMEOUT_MS",
    "PRIMAL_HTTP_MAX_RETRIES",
    "OWNER_NWC",
    "OWNER_NWC_RELAY",
    "OWNER_NWC_RELAYS",
    "NOSTR_NSEC",
    "FEEDBACK_INBOX_NPUB",
    "NOSTR_PUBLISHER_API_TOKEN",
    "SENTRY_DSN",
    "SENTRY_TRACES_SAMPLE_RATE",
    "SENTRY_PROFILES_SAMPLE_RATE",
    "RELAY_HEALTH_STORE",
    "PORT",
    "METRICS_PORT",
    "WORKER_METRICS_PORT",
    "FLY_REGION",
    "PRIMARY_REGION",
    "TEST_DATABASE_URL",
    "ENABLE_SOURCE_MAPS",
    "E2E_TEST",
    "APP_URL",
    "ALLOWED_ORIGINS",
    "METRICS_TOKEN",
    "METRICS_ALLOWED_IPS",
    "HOST",
    "DISABLE_RATE_LIMIT",
    "NOSTR_AUTH_V2_ENABLED",
    "ENFORCE_NOSTR_SESSION_PUBKEY",
    "MEDIA_PIPELINE_V2_ENABLED",
    "ENABLE_NOSTR_DELETE_EVENTS",
    "NOSTR_DM_NIP17_ENABLED",
    "NIP88_POLLS_ENABLED",
    "CONTESTS_V1_ENABLED",
    "SUBSCRIPTION_CHECKOUT_V2_ENABLED",
    "BTCPAY_URL",
    "BTCPAY_API_KEY",
    "BTCPAY_STORE_ID",
    "BTCPAY_WEBHOOK_SECRET",
    "BLOSSOM_INTERNAL_SECRET",
    "BLOSSOM_SFS_API_URL",
    "BLOSSOM_UPLOAD_TOKEN_SECRET",
    "BLASTR_ADMIN_URL",
    "BLASTR_ADMIN_API_TOKEN",
    "STORAGE_CDN_URL",
    "REFERRAL_LANDING_URL",
    "REFERRAL_MANUAL_PAYOUT_SECRET",
    "ADMIN_NPUBS",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "COOLIFY_URL",
    "CYPRESS",
  ];

  optionalVars.forEach((key) => {
    const value = process.env[key];
    if (value) {
      config[key] = value;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: process.env.NODE_ENV may be undefined in some environments
  config.NODE_ENV = process.env["NODE_ENV"] ?? "development";
}

function reportValidationErrors(
  missing: string[],
  invalid: ValidationError[]
): void {
  safeConsoleError("❌ Environment validation failed:");

  if (missing.length > 0) {
    safeConsoleError("\nMissing required environment variables:");
    missing.forEach((key) => safeConsoleError(`  - ${key}`));
  }

  if (invalid.length > 0) {
    safeConsoleError("\nInvalid environment variables:");
    invalid.forEach(({ key, reason }) =>
      safeConsoleError(`  - ${key}: ${reason}`)
    );
  }

  safeConsoleError(
    "\nPlease check your .env file or environment configuration."
  );
  safeConsoleError(
    "See docs/getting-started/environment-setup.md for detailed configuration instructions."
  );

  process.exit(1);
}

/**
 * Validates environment variables and returns typed config
 * Throws error if validation fails (prevents app from starting)
 */
function validateAndGetEnv(): EnvConfig {
  // Provide default values for E2E tests if variables are not set
  if (process.env["E2E_TEST"] === "true") {
    process.env["DATABASE_URL"] ??=
      process.env["TEST_DATABASE_URL"] ??
      "postgresql://postgres:postgres@localhost:5432/smartflow_test";
    process.env["SESSION_SECRET"] ??=
      "test-session-secret-very-long-and-secure-32-chars-minimum";
    process.env["NOSTR_PUBLISHER_URL"] ??= "http://localhost:3001/publish";
    process.env["REDIS_URL"] ??= "redis://localhost:6379";
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
      const error = validateRequiredVariable(key, value);
      if (error) {
        invalid.push(error);
      }
    }
  }

  // Validate storage variables: if any is set, all must be set
  const storageMissing = validateStorageVariables(storageVariables);
  missing.push(...storageMissing);

  // Report errors
  if (missing.length > 0 || invalid.length > 0) {
    reportValidationErrors(missing, invalid);
  }

  // Build typed config object
  const config = buildBaseConfig();

  // Check if all storage variables are set
  const storageValues = storageVariables.map((key) => process.env[key]);
  const hasAllStorage = storageValues.every((v) => v && v.trim() !== "");

  // Add optional storage config if all are set
  addOptionalStorageConfig(config, hasAllStorage);

  // Add other optional variables
  addOptionalConfig(config);

  safeConsoleLog("✅ Environment variables validated");
  return config;
}

// Validate and export typed environment config
// This runs at module load time, so validation happens before app starts
export const env = validateAndGetEnv();

// Export type for use in other modules
export type { EnvConfig };
