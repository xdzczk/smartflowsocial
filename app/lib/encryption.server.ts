import crypto from "crypto";

import { env } from "~/lib/env.server";

// Encryption version constants
const VERSION_LEGACY_CBC = 0x01; // Legacy AES-256-CBC (no version byte in old format)
const VERSION_GCM = 0x02; // New AES-256-GCM

// Algorithm constants
const ALGORITHM_LEGACY = "aes-256-cbc";
const ALGORITHM_GCM = "aes-256-gcm";

// Length constants
const IV_LENGTH_CBC = 16;
const IV_LENGTH_GCM = 12; // GCM uses 12-byte IV (96 bits)
const AUTH_TAG_LENGTH = 16; // GCM authentication tag
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const VERSION_LENGTH = 1;

/**
 * Derive encryption key from SESSION_SECRET
 */
function deriveKey(salt: Buffer): Buffer {
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error(
      "SESSION_SECRET environment variable is required for encryption"
    );
  }

  return crypto.pbkdf2Sync(sessionSecret, salt, 100000, KEY_LENGTH, "sha512");
}

/**
 * Encrypt sensitive data using AES-256-GCM (authenticated encryption)
 * Format: [VERSION(1)] [SALT(32)] [IV(12)] [ENCRYPTED_DATA] [AUTH_TAG(16)]
 */
export function encrypt(text: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH_GCM);
    const key = deriveKey(salt);

    const cipher = crypto.createCipheriv(ALGORITHM_GCM, key, iv);

    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag (required for GCM)
    const authTag = cipher.getAuthTag();

    // Combine: version + salt + iv + encrypted + authTag
    const combined = Buffer.concat([
      Buffer.from([VERSION_GCM]), // Version byte
      salt,
      iv,
      encrypted,
      authTag,
    ]);

    return combined.toString("base64");
  } catch (_error) {
    // Use safe logging to prevent sensitive data in logs

    const { safeConsoleError } =
      require("./secrets-sanitizer.server") as unknown as {
        safeConsoleError: (message: string) => void;
      };
    safeConsoleError("Encryption failed");
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data with backward compatibility
 * Supports both legacy CBC and new GCM formats
 */
export function decrypt(encryptedData: string): string {
  try {
    const combined = Buffer.from(encryptedData, "base64");

    // Check if this is the new format (has version byte)
    // Legacy format: [SALT(32)] [IV(16)] [ENCRYPTED_DATA]
    // New format: [VERSION(1)] [SALT(32)] [IV(12)] [ENCRYPTED_DATA] [AUTH_TAG(16)]

    let version: number;
    let salt: Buffer;
    let iv: Buffer;
    let encrypted: Buffer;
    let authTag: Buffer | undefined;

    // Detect format: if first byte is a valid version, use new format
    // Otherwise, assume legacy CBC format
    if (combined.length >= VERSION_LENGTH + SALT_LENGTH + IV_LENGTH_CBC) {
      const firstByte = combined[0];
      if (firstByte === VERSION_GCM) {
        // New GCM format
        version = VERSION_GCM;
        let offset = VERSION_LENGTH;
        salt = combined.subarray(offset, offset + SALT_LENGTH);
        offset += SALT_LENGTH;
        iv = combined.subarray(offset, offset + IV_LENGTH_GCM);
        offset += IV_LENGTH_GCM;
        authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
        encrypted = combined.subarray(
          offset,
          combined.length - AUTH_TAG_LENGTH
        );
      } else {
        // Legacy CBC format (no version byte)
        version = VERSION_LEGACY_CBC;
        salt = combined.subarray(0, SALT_LENGTH);
        iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH_CBC);
        encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH_CBC);
      }
    } else {
      // Too short, assume legacy format
      version = VERSION_LEGACY_CBC;
      salt = combined.subarray(0, SALT_LENGTH);
      iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH_CBC);
      encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH_CBC);
    }

    const key = deriveKey(salt);

    if (version === VERSION_GCM && authTag) {
      // New GCM decryption
      const decipher = crypto.createDecipheriv(ALGORITHM_GCM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    } else {
      // Legacy CBC decryption (for backward compatibility)
      const decipher = crypto.createDecipheriv(ALGORITHM_LEGACY, key, iv);

      let decrypted = decipher.update(encrypted, undefined, "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    }
  } catch (_error) {
    // Use safe logging to prevent sensitive data in logs

    const { safeConsoleError } =
      require("./secrets-sanitizer.server") as unknown as {
        safeConsoleError: (message: string) => void;
      };
    safeConsoleError("Decryption failed");
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Validate NWC connection string format
 */
export function validateNWCString(nwcString: string): boolean {
  try {
    // Basic validation for NWC format
    return (
      nwcString.startsWith("nostr+walletconnect://") && nwcString.length > 30
    );
  } catch {
    return false;
  }
}

/**
 * Mask NWC string for display (show only first and last few characters)
 */
export function maskNWCString(nwcString: string): string {
  if (!nwcString || nwcString.length < 10) {
    return "***";
  }

  const prefix = nwcString.substring(0, 25); // nostr+walletconnect://
  const visible = nwcString.substring(25, 29); // First few chars after protocol
  const masked = "...";
  const suffix = nwcString.substring(nwcString.length - 4); // Last 4 chars

  return `${prefix}${visible}${masked}${suffix}`;
}
