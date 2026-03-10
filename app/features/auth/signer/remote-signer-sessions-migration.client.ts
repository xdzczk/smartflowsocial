import { getActiveSignerConfig } from "./nostr-signer-storage.client";
import {
  createSession,
  getAllSessions,
  setActiveSession,
} from "./remote-signer-sessions.client";

const MIGRATION_FLAG_KEY = "__smartflow_remote_signer_migrated_v1";

/**
 * Migrate existing active signer config to new connection/session system.
 * This is a one-time migration that runs automatically.
 */
export function migrateExistingConfig(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  // Check if already migrated
  try {
    const migrated = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrated === "true") {
      return;
    }
  } catch {
    // Continue with migration
  }

  // Check if there are already connections (user might have created them manually)
  const existingSessions = getAllSessions();
  if (existingSessions.length > 0) {
    // Already have connections, mark as migrated
    try {
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    } catch {
      // ignore
    }
    return;
  }

  // Get existing active signer config
  const existingConfig = getActiveSignerConfig();
  if (!existingConfig) {
    // No existing config, mark as migrated
    try {
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    } catch {
      // ignore
    }
    return;
  }

  // Skip NIP-07 (browser extension) - doesn't need connection management
  if (existingConfig.type === "nip07") {
    try {
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    } catch {
      // ignore
    }
    return;
  }

  // Create connection from existing config
  try {
    const session = createSession(existingConfig, "Migrated Session");
    setActiveSession(session.id);

    // Mark as migrated
    localStorage.setItem(MIGRATION_FLAG_KEY, "true");
  } catch (error) {
    console.warn("Failed to migrate existing signer config:", error);
    // Still mark as migrated to avoid retrying
    try {
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    } catch {
      // ignore
    }
  }
}

/**
 * Run migration on module load (client-side only)
 */
if (typeof window !== "undefined") {
  // Run migration after a short delay to ensure other modules are loaded
  setTimeout(() => {
    migrateExistingConfig();
  }, 100);
}
