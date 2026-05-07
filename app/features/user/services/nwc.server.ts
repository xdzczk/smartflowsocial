import {
  decrypt,
  encrypt,
  maskNWCString,
  validateNWCString,
} from "~/lib/encryption.server";

import type { User } from "../data/user-prisma-types.server";
import {
  clearUserNwc as clearUserNwcRow,
  findUserEncryptedNwc,
  findUserNwcFields,
  touchUserNwcLastUsed as touchUserNwcLastUsedRow,
  updateUserNwc as updateUserNwcRow,
  updateUserNwcEnabled as updateUserNwcEnabledRow,
} from "../repositories/nwc-data.server";

/**
 * Updates user's NWC (Nostr Wallet Connect) connection string
 * Validates and encrypts the NWC string before storing
 */
export async function updateUserNWC(
  userId: string,
  nwcString: string,
  enabled = true
): Promise<User> {
  if (!validateNWCString(nwcString)) {
    throw new Error("Invalid NWC connection string format");
  }
  const encryptedNwc = encrypt(nwcString);
  const now = new Date();
  return updateUserNwcRow(userId, {
    encryptedNwc,
    nwcEnabled: enabled,
    nwcLastUsed: now,
  });
}

/**
 * Updates whether NWC is enabled for a user
 */
export async function updateUserNWCEnabled(
  userId: string,
  enabled: boolean
): Promise<User> {
  return updateUserNwcEnabledRow(
    userId,
    enabled,
    enabled ? new Date() : undefined
  );
}

/**
 * Clears user's NWC connection string
 */
export function clearUserNWC(userId: string): Promise<User> {
  return clearUserNwcRow(userId);
}

/**
 * Gets user's NWC information (masked string, enabled status, last used)
 * Returns masked string for display purposes
 */
export async function getUserNWC(userId: string): Promise<{
  enabled: boolean;
  maskedString?: string;
  lastUsed?: Date | null;
}> {
  const user = await findUserNwcFields(userId);
  if (!user) return { enabled: false };

  let maskedString: string | undefined;
  if (user.encryptedNwc) {
    try {
      maskedString = maskNWCString(decrypt(user.encryptedNwc));
    } catch {
      // If decryption fails, we can't show the masked string
    }
  }

  return {
    enabled: user.nwcEnabled,
    maskedString,
    lastUsed: user.nwcLastUsed,
  };
}

/**
 * Gets decrypted NWC string for a user
 * Only returns if NWC is enabled and decryption succeeds
 * Used for payment processing
 */
export async function getDecryptedUserNWC(
  userId: string
): Promise<string | null> {
  const user = await findUserEncryptedNwc(userId);
  if (!user?.encryptedNwc || !user.nwcEnabled) return null;

  try {
    return decrypt(user.encryptedNwc);
  } catch (_error) {
    // Use safe logging to prevent NWC strings from appearing in logs

    const { safeConsoleError } =
      require("~/lib/secrets-sanitizer.server") as unknown as {
        safeConsoleError: (message: string, userId: string) => void;
      };
    safeConsoleError("Failed to decrypt NWC string for user", userId);
    return null;
  }
}

/**
 * Returns true only when the user has a usable wallet connection:
 * - NWC enabled
 * - encrypted secret present
 * - decryption succeeds to a valid-looking NWC string
 */
export async function hasUsableNwc(userId: string): Promise<boolean> {
  const decrypted = await getDecryptedUserNWC(userId);
  return Boolean(decrypted && validateNWCString(decrypted));
}

/** Record that the user's NWC wallet was used (e.g. after a successful zap). */
export async function touchUserNwcLastUsed(userId: string): Promise<void> {
  await touchUserNwcLastUsedRow(userId);
}
