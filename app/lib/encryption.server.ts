import crypto from "crypto";

import { env } from "~/lib/env.server";

// Encryption version constants
const VERSION_GCM = 0x02; // AES-256-GCM

// Algorithm and length constants
const ALGORITHM_GCM = "aes-256-gcm";
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
 * Decrypt sensitive data (AES-256-GCM format only)
 * Format: [VERSION(1)] [SALT(32)] [IV(12)] [ENCRYPTED_DATA] [AUTH_TAG(16)]
 */
export function decrypt(encryptedData: string): string {
  try {
    const combined = Buffer.from(encryptedData, "base64");

    const minLength =
      VERSION_LENGTH + SALT_LENGTH + IV_LENGTH_GCM + AUTH_TAG_LENGTH;
    if (combined.length < minLength || combined[0] !== VERSION_GCM) {
      throw new Error("Unsupported or invalid encryption format");
    }

    let offset = VERSION_LENGTH;
    const salt = combined.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;
    const iv = combined.subarray(offset, offset + IV_LENGTH_GCM);
    offset += IV_LENGTH_GCM;
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(
      offset,
      combined.length - AUTH_TAG_LENGTH
    );

    const key = deriveKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
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
