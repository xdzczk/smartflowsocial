/**
 * Job Payload Version Handler
 *
 * Handles version checking and migration for job payloads.
 * Ensures backward compatibility when schema versions change.
 */

import { logWarning, logError } from "~/lib/error-logger.server";
import type {
  PostScheduledPayload,
  LongFormPostScheduledPayload,
} from "~/infra/outbox/outbox.server";

/**
 * Supported schema versions
 */
export const SUPPORTED_VERSIONS = {
  "1.0": {
    postScheduled: true,
    longFormPostScheduled: true,
  },
  // Future versions can be added here
  // "2.0": { ... }
} as const;

export type SupportedVersion = keyof typeof SUPPORTED_VERSIONS;

/**
 * Current schema version
 */
export const CURRENT_VERSION: SupportedVersion = "1.0";

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): version is SupportedVersion {
  return version in SUPPORTED_VERSIONS;
}

/**
 * Get the version from a payload
 */
export function getPayloadVersion(
  payload: unknown
): string | undefined {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "schemaVersion" in payload
  ) {
    return typeof payload.schemaVersion === "string"
      ? payload.schemaVersion
      : undefined;
  }
  return undefined;
}

/**
 * Validate payload version
 */
export function validatePayloadVersion(
  payload: unknown,
  context?: { eventId?: string; aggregateId?: string }
): {
  valid: boolean;
  version: string | undefined;
  error?: string;
} {
  const version = getPayloadVersion(payload);

  if (!version) {
    return {
      valid: false,
      version: undefined,
      error: "Missing schemaVersion in payload",
    };
  }

  if (!isVersionSupported(version)) {
    logWarning(`Unsupported schema version: ${version}`, {
      version,
      supportedVersions: Object.keys(SUPPORTED_VERSIONS),
      ...context,
    });
    return {
      valid: false,
      version,
      error: `Unsupported schema version: ${version}. Supported versions: ${Object.keys(SUPPORTED_VERSIONS).join(", ")}`,
    };
  }

  return {
    valid: true,
    version,
  };
}

/**
 * Migrate payload to current version
 * Currently all versions are compatible, but this provides a hook for future migrations
 */
export function migratePayloadToCurrentVersion<T extends PostScheduledPayload | LongFormPostScheduledPayload>(
  payload: T,
  fromVersion: string
): T {
  if (fromVersion === CURRENT_VERSION) {
    // Already at current version
    return payload;
  }

  // Log migration for monitoring
  logWarning(`Migrating payload from version ${fromVersion} to ${CURRENT_VERSION}`, {
    fromVersion,
    toVersion: CURRENT_VERSION,
    postId: payload.postId,
  });

  // For now, all versions are compatible, so just return as-is
  // Future versions can add migration logic here
  // Example:
  // if (fromVersion === "1.0" && CURRENT_VERSION === "2.0") {
  //   return migrateV1ToV2(payload);
  // }

  return payload;
}

/**
 * Normalize payload to ensure it has all required fields
 * Handles missing optional fields from older versions
 */
export function normalizePayload(
  payload: unknown,
  version: string
): PostScheduledPayload | LongFormPostScheduledPayload | null {
  if (!isVersionSupported(version)) {
    return null;
  }

  // For version 1.0, ensure all required fields are present
  if (version === "1.0") {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "postId" in payload &&
      "userId" in payload &&
      "signedEvent" in payload &&
      "scheduledFor" in payload
    ) {
      const normalized = payload as PostScheduledPayload | LongFormPostScheduledPayload;
      
      // Ensure schemaVersion is set
      if (!normalized.schemaVersion) {
        normalized.schemaVersion = "1.0";
      }

      // Ensure correlationId exists (optional, added later)
      if (!("correlationId" in normalized)) {
        (normalized as { correlationId?: string }).correlationId = undefined;
      }

      return normalized;
    }
  }

  return null;
}

/**
 * Process payload with version handling
 * Validates version, migrates if needed, and normalizes
 */
export function processPayloadWithVersion<T extends PostScheduledPayload | LongFormPostScheduledPayload>(
  payload: unknown,
  context?: { eventId?: string; aggregateId?: string }
): {
  success: boolean;
  payload?: T;
  version?: string;
  error?: string;
} {
  // Validate version
  const validation = validatePayloadVersion(payload, context);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const version = validation.version!;

  // Normalize payload
  const normalized = normalizePayload(payload, version);
  if (!normalized) {
    return {
      success: false,
      error: "Failed to normalize payload",
      version,
    };
  }

  // Migrate if needed
  const migrated = migratePayloadToCurrentVersion(normalized, version);

  return {
    success: true,
    payload: migrated as T,
    version: CURRENT_VERSION,
  };
}
