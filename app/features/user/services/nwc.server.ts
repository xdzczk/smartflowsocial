import type { User } from "@prisma/client";

import {
  encrypt,
  decrypt,
  validateNWCString,
  maskNWCString,
} from "~/lib/encryption.server";
import { prisma } from "~/lib/prisma.server";

/**
 * Updates user's NWC (Nostr Wallet Connect) connection string
 * Validates and encrypts the NWC string before storing
 */
export async function updateUserNWC(
  userId: string,
  nwcString: string,
  enabled = true,
): Promise<User> {
  // Validate NWC string format
  if (!validateNWCString(nwcString)) {
    throw new Error("Invalid NWC connection string format");
  }

  // Encrypt the NWC string before storing
  const encryptedNwc = encrypt(nwcString);

  const result = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      encryptedNwc,
      nwcEnabled: enabled,
      nwcLastUsed: new Date(),
    },
  });

  return result;
}

/**
 * Updates whether NWC is enabled for a user
 */
export async function updateUserNWCEnabled(
  userId: string,
  enabled: boolean,
): Promise<User> {
  const result = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      nwcEnabled: enabled,
      ...(enabled && { nwcLastUsed: new Date() }),
    },
  });

  return result;
}

/**
 * Clears user's NWC connection string
 */
export function clearUserNWC(userId: string): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      encryptedNwc: null,
      nwcEnabled: false,
      nwcLastUsed: null,
    },
  });
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
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      nwcEnabled: true,
      encryptedNwc: true,
      nwcLastUsed: true,
    },
  });

  if (!user) {
    return { enabled: false };
  }

  let maskedString: string | undefined;
  if (user.encryptedNwc) {
    try {
      const decryptedNwc = decrypt(user.encryptedNwc);
      maskedString = maskNWCString(decryptedNwc);
    } catch (_error) {
      // If decryption fails, we can't show the masked string
    }
  }

  const result = {
    enabled: user.nwcEnabled,
    maskedString,
    lastUsed: user.nwcLastUsed,
  };

  return result;
}

/**
 * Gets decrypted NWC string for a user
 * Only returns if NWC is enabled and decryption succeeds
 * Used for payment processing
 */
export async function getDecryptedUserNWC(
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      encryptedNwc: true,
      nwcEnabled: true,
    },
  });

  if (!user?.encryptedNwc || !user.nwcEnabled) {
    return null;
  }

  try {
    return decrypt(user.encryptedNwc);
  } catch (error) {
    // Use safe logging to prevent NWC strings from appearing in logs
     
    const { safeConsoleError } = require("~/lib/secrets-sanitizer.server");
    safeConsoleError("Failed to decrypt NWC string for user", userId);
    return null;
  }
}


