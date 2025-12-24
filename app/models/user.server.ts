import type {
  User,
  HashTagPreset,
  QueueType,
  ScheduleType,
  UploadProvider,
} from "@prisma/client";

import {
  encrypt,
  decrypt,
  validateNWCString,
  maskNWCString,
} from "~/lib/encryption.server";
import { prisma } from "~/lib/prisma.server";
import { blastrRelay } from "~/lib/relays";

type UserWithHashTagPresets = User & {
  hashTagPresets: HashTagPreset[];
};

interface UpdateUserProfileParams {
  nostrProfile: string;
  npub: string;
}

export async function updateUserProfile({
  nostrProfile,
  npub,
}: UpdateUserProfileParams): Promise<User> {
  return prisma.user.update({
    where: { npub },
    data: {
      nostrProfile: nostrProfile,
    },
  });
}

export async function getUserById(
  id: string,
): Promise<UserWithHashTagPresets | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      hashTagPresets: true,
    },
  });

  if (!user) {
    return null;
  }

  // Check if user has Premium or Founder subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: id },
    include: {
      Plan: true,
    },
  });

  // Include blastrRelay if user has Premium or Founder plan with ACTIVE status
  if (
    subscription?.status === "ACTIVE" &&
    subscription?.Plan?.name &&
    (subscription.Plan.name.toLowerCase() === "premium" ||
      subscription.Plan.name.toLowerCase() === "founder")
  ) {
    // Add blastrRelay if not already present
    if (!user.userRelays.includes(blastrRelay)) {
      return {
        ...user,
        userRelays: [...user.userRelays, blastrRelay],
      };
    }
  }

  return user;
}

export async function getUserByNpub(npub: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { npub } });
}

export async function createUser(
  npub: string,
  nostrProfile: string,
): Promise<User> {
  return prisma.user.upsert({
    where: { npub },
    update: { nostrProfile },
    create: {
      npub,
      nostrProfile,
    },
  });
}

// Hashtag Preset Management Functions
export async function createHashTagPreset(
  userId: string,
  name: string,
  tags: string,
  description?: string,
): Promise<HashTagPreset> {
  return prisma.hashTagPreset.create({
    data: {
      userId,
      name: name.trim(),
      tags: tags.trim(),
      description: description?.trim(),
    },
  });
}

export async function updateHashTagPreset(
  userId: string,
  id: string,
  name: string,
  tags: string,
  description?: string,
): Promise<HashTagPreset> {
  return prisma.hashTagPreset.update({
    where: {
      id,
      userId,
    },
    data: {
      name: name.trim(),
      tags: tags.trim(),
      description: description?.trim(),
    },
  });
}

export async function deleteHashTagPreset(
  userId: string,
  id: string,
): Promise<void> {
  await prisma.hashTagPreset.delete({
    where: {
      id,
      userId,
    },
  });
}

export async function getUserHashTagPresets(
  userId: string,
): Promise<HashTagPreset[]> {
  return prisma.hashTagPreset.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function getHashTagPresetById(
  userId: string,
  id: string,
): Promise<HashTagPreset | null> {
  return prisma.hashTagPreset.findFirst({
    where: {
      id,
      userId,
    },
  });
}

// Legacy functions for backward compatibility
export async function updateUserHashTags(
  userId: string,
  tags: string,
): Promise<HashTagPreset | null> {
  // For backward compatibility, we'll create or update a "Default" preset
  const existingDefault = await prisma.hashTagPreset.findFirst({
    where: {
      userId,
      name: "Default",
    },
  });

  if (existingDefault) {
    return prisma.hashTagPreset.update({
      where: {
        id: existingDefault.id,
      },
      data: {
        tags,
      },
    });
  } else {
    return prisma.hashTagPreset.create({
      data: {
        userId,
        name: "Default",
        tags,
        description: "Default hashtags",
      },
    });
  }
}

export async function updateUserHashTagsAndSettings(
  userId: string,
  showHashTagsInPosts: boolean,
): Promise<User> {
  // Update the user's showHashTagsinPosts setting
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      showHashTagsinPosts: showHashTagsInPosts,
    },
  });
}

export async function getUserHashTags(userId: string): Promise<string> {
  // For backward compatibility, try to get "Default" preset
  const defaultPreset = await prisma.hashTagPreset.findFirst({
    where: {
      userId,
      name: "Default",
    },
  });
  return defaultPreset?.tags || "";
}

export async function getShowHashTagsInPosts(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      showHashTagsinPosts: true,
    },
  });
  return user?.showHashTagsinPosts || false;
}

export async function updateShowHashTagsInPosts(
  userId: string,
  showHashTags: boolean,
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      showHashTagsinPosts: showHashTags,
    },
  });
}

export async function updateUserTimezone(
  userId: string,
  timezone: string,
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      timezone: timezone,
    },
  });
}

export async function getUserTimezone(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      timezone: true,
    },
  });
  return user?.timezone || null;
}

export async function updateUserRelays(
  userId: string,
  relays: string[],
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      userRelays: relays,
    },
  });
}

export async function getUserRelays(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      userRelays: true,
    },
  });

  const userRelays = user?.userRelays || [];

  // Check if user has Premium or Founder subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      Plan: true,
    },
  });

  // Include blastrRelay if user has Premium or Founder plan with ACTIVE status
  if (
    subscription?.status === "ACTIVE" &&
    subscription?.Plan?.name &&
    (subscription.Plan.name.toLowerCase() === "premium" ||
      subscription.Plan.name.toLowerCase() === "founder")
  ) {
    // Add blastrRelay if not already present
    if (!userRelays.includes(blastrRelay)) {
      return [...userRelays, blastrRelay];
    }
  }

  return userRelays;
}

export async function updateGiveawayBlacklist(
  userId: string,
  blacklistedItems: string[],
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      giveawayBlackListed: blacklistedItems,
    },
  });
}

export async function getGiveawayBlacklist(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      giveawayBlackListed: true,
    },
  });
  return user?.giveawayBlackListed || [];
}

export async function updateScheduleInterval(
  userId: string,
  intervals: string[],
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      scheduleInterval: intervals,
    },
  });
}

export async function getScheduleInterval(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      scheduleInterval: true,
    },
  });
  return user?.scheduleInterval || [];
}

export async function createDefaultQueueTypes(userId: string): Promise<void> {
  const defaultQueueTypes = [
    {
      name: "Unassigned",
      scheduleType: "INTERVAL" as ScheduleType,
      scheduleConfig: { useGlobalInterval: true }, // Use global schedule intervals
      color: "#6B7280", // Gray
      description: "Default queue for unassigned posts",
      isDefault: true,
    },
  ];

  // Check if user already has queue types
  const existingCount = await prisma.queueType.count({
    where: { userId },
  });

  // Only create defaults if user has no queue types
  if (existingCount === 0) {
    await prisma.queueType.createMany({
      data: defaultQueueTypes.map((qt) => ({
        ...qt,
        userId,
      })),
    });
  }
}

export async function updateQueueType(
  userId: string,
  queueTypeData: {
    id?: string;
    name: string;
    scheduleType: ScheduleType;
    scheduleConfig: any;
    color?: string;
    description?: string;
    isEnabled?: boolean;
    hashTagPresetId?: string | null;
  },
): Promise<QueueType> {
  if (queueTypeData.id) {
    // Update existing queue type
    const updateData: any = {
      name: queueTypeData.name.trim(),
      scheduleType: queueTypeData.scheduleType,
      scheduleConfig: queueTypeData.scheduleConfig,
      color: queueTypeData.color,
      description: queueTypeData.description,
      isEnabled: queueTypeData.isEnabled ?? true,
    };

    // Handle hashtag preset relationship
    if (queueTypeData.hashTagPresetId === null) {
      updateData.hashTagPreset = { disconnect: true };
    } else if (queueTypeData.hashTagPresetId) {
      updateData.hashTagPreset = {
        connect: { id: queueTypeData.hashTagPresetId },
      };
    }

    return prisma.queueType.update({
      where: {
        id: queueTypeData.id,
        userId: userId,
      },
      data: updateData,
    });
  } else {
    // Create new queue type
    const createData: any = {
      userId: userId,
      name: queueTypeData.name.trim(),
      scheduleType: queueTypeData.scheduleType,
      scheduleConfig: queueTypeData.scheduleConfig,
      color: queueTypeData.color,
      description: queueTypeData.description,
      isEnabled: queueTypeData.isEnabled ?? true,
      hashTagPresetId: queueTypeData.hashTagPresetId,
    };

    return prisma.queueType.create({
      data: createData,
    });
  }
}

export async function deleteQueueType(
  userId: string,
  queueTypeId: string,
): Promise<void> {
  await prisma.queueType.delete({
    where: {
      id: queueTypeId,
      userId: userId,
    },
  });
}

export async function getQueueTypes(userId: string): Promise<QueueType[]> {
  // Ensure user has default queue types
  await createDefaultQueueTypes(userId);

  return prisma.queueType.findMany({
    where: {
      userId: userId,
    },
    include: {
      hashTagPreset: true,
    },
    orderBy: [
      { isDefault: "desc" }, // Default types first
      { createdAt: "asc" },
    ],
  });
}

// Legacy function for backward compatibility - now returns just names
export async function getQueueType(userId: string): Promise<string[]> {
  const queueTypes = await getQueueTypes(userId);
  return queueTypes.map((qt) => qt.name);
}

// Deprecated function - hashtags are now managed via presets at post level
export async function getEffectiveHashtags(
  userId: string,
  hashTagPresetId?: string,
): Promise<string> {
  // If hashtag preset is specified, get its tags
  if (hashTagPresetId) {
    const preset = await prisma.hashTagPreset.findFirst({
      where: {
        id: hashTagPresetId,
        userId: userId,
      },
      select: {
        tags: true,
      },
    });

    if (preset?.tags) {
      return preset.tags;
    }
  }

  // Otherwise, return empty string (no default hashtags)
  return "";
}

export async function updateUserUploadProvider(
  userId: string,
  uploadProvider: UploadProvider,
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      uploadProvider: uploadProvider,
    },
  });
}

export async function getUserUploadProvider(
  userId: string,
): Promise<UploadProvider> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      uploadProvider: true,
    },
  });

  // Handle legacy BLOSSOM value by converting to BLOSSOM_PRIMAL
  const provider = user?.uploadProvider || "S3";
  if (provider === ("BLOSSOM" as any)) {
    return "BLOSSOM_PRIMAL";
  }
  return provider;
}

export async function getUserEnableMirrorBlossom(
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      enableMirrorBlossom: true,
    },
  });
  return user?.enableMirrorBlossom || false;
}

export async function updateUserEnableMirrorBlossom(
  userId: string,
  enableMirrorBlossom: boolean,
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      enableMirrorBlossom: enableMirrorBlossom,
    },
  });
}

export async function getUserMirrorUploadUrls(
  userId: string,
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      mirrorUploadUrls: true,
    },
  });
  return user?.mirrorUploadUrls || [];
}

export async function updateUserMirrorUploadUrls(
  userId: string,
  mirrorUrls: string[],
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      mirrorUploadUrls: mirrorUrls,
    },
  });
}

// NWC (Nostr Wallet Connect) Management Functions
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

export async function clearUserNWC(userId: string): Promise<User> {
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
    console.error("Failed to decrypt NWC string:", error);
    return null;
  }
}

// --- Accounts (Parent/Child) helpers ---

type MinimalUser = Pick<User, "id" | "npub"> & {
  nostrProfile?: any | null;
  isChild?: boolean;
  parentNpub?: string | null;
  pendingParentRequests?: string[];
};

function extractProfileBits(nostrProfile: any | null | undefined): {
  name?: string;
  display_name?: string;
  picture?: string;
} {
  if (!nostrProfile) return {};
  try {
    if (typeof nostrProfile === "string") {
      const parsed = JSON.parse(nostrProfile);
      return {
        name: parsed?.name,
        display_name: parsed?.display_name,
        picture: parsed?.picture,
      };
    }
    if (typeof nostrProfile === "object") {
      return {
        name: (nostrProfile as any)?.name,
        display_name: (nostrProfile as any)?.display_name,
        picture: (nostrProfile as any)?.picture,
      };
    }
  } catch { }
  return {};
}

export async function searchUsersByProfileName(
  query: string,
  excludeNpub?: string,
  limit = 20,
): Promise<
  (MinimalUser & {
    profileName?: string;
    profileDisplayName?: string;
    profilePicture?: string;
  })[]
> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Broad prefilter to avoid full table scan; then filter in app
  const fetched = await prisma.user.findMany({
    where: {
      AND: [
        excludeNpub ? { npub: { not: excludeNpub } } : {},
        {
          OR: [
            { npub: { contains: trimmed, mode: "insensitive" } },
            { nostrProfile: { not: null } },
          ],
        },
      ],
    },
    take: 200,
    select: {
      id: true,
      npub: true,
      nostrProfile: true,
      isChild: true,
      parentNpub: true,
      pendingParentRequests: true,
    },
  });

  const lowered = trimmed.toLowerCase();
  const filtered = fetched
    .map((u) => {
      const bits = extractProfileBits(u.nostrProfile);
      const name = bits.name || bits.display_name || "";
      return {
        ...u,
        profileName: bits.name,
        profileDisplayName: bits.display_name,
        profilePicture: bits.picture,
        _match:
          u.npub.toLowerCase().includes(lowered) ||
          (name && name.toLowerCase().includes(lowered)),
      };
    })
    .filter((u) => u._match)
    .slice(0, limit)
    .map(({ _match, ...rest }) => rest);

  return filtered;
}

export async function requestChildLink(
  parentHex: string,
  childHex: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Directly use 64-char hex keys, no normalization or conversion.
  const parent = (parentHex || "").trim();
  const child = (childHex || "").trim();

  if (!/^[0-9a-fA-F]{64}$/.test(parent) || !/^[0-9a-fA-F]{64}$/.test(child)) {
    console.warn("[requestChildLink] Invalid hex key(s)", { parent, child });
    return { ok: false, reason: "Invalid hex public key provided." };
  }

  if (parent === child) {
    console.warn("[requestChildLink] Attempt to add self as child", { parent });
    return { ok: false, reason: "You cannot add yourself as a child." };
  }

  const childUser = await prisma.user.findUnique({ where: { npub: child } });
  if (!childUser) {
    console.error("[requestChildLink] Child account not found in DB", {
      child,
    });
    return { ok: false, reason: "Child account not found." };
  }

  if (childUser.parentNpub) {
    console.warn("[requestChildLink] Child already linked to a parent", {
      parentNpub: childUser.parentNpub,
      child: childUser.npub,
    });
    return { ok: false, reason: "This account is already linked to a parent." };
  }

  const alreadyRequested = (childUser.pendingParentRequests || []).includes(
    parent,
  );
  if (alreadyRequested) {
    return { ok: true };
  }

  await prisma.user.update({
    where: { npub: childUser.npub },
    data: {
      pendingParentRequests: { push: parent },
    },
  });

  return { ok: true };
}

export async function cancelChildLinkRequest(
  parentHex: string,
  childHex: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parent = (parentHex || "").trim();
  const child = (childHex || "").trim();

  if (!/^[0-9a-fA-F]{64}$/.test(parent) || !/^[0-9a-fA-F]{64}$/.test(child)) {
    return { ok: false, reason: "Invalid hex public key provided." };
  }

  const childUser = await prisma.user.findUnique({ where: { npub: child } });
  if (!childUser) return { ok: false, reason: "Child account not found." };

  const pending = childUser.pendingParentRequests || [];
  if (!pending.includes(parent)) {
    return { ok: false, reason: "No pending request to cancel." };
  }

  await prisma.user.update({
    where: { npub: child },
    data: {
      pendingParentRequests: pending.filter((p) => p !== parent),
    },
  });

  return { ok: true };
}

export async function getConfirmedChildrenForParent(parentNpub: string) {
  return prisma.user.findMany({
    where: { parentNpub },
    select: {
      id: true,
      npub: true,
      nostrProfile: true,
      isChild: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPendingChildrenForParent(parentNpub: string) {
  return prisma.user.findMany({
    where: { pendingParentRequests: { has: parentNpub } },
    select: { id: true, npub: true, nostrProfile: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPendingParentRequestsForChild(childNpub: string) {
  const child = await prisma.user.findUnique({
    where: { npub: childNpub },
    select: { pendingParentRequests: true },
  });
  return child?.pendingParentRequests ?? [];
}

export async function respondToChildRequest(
  childNpub: string,
  parentNpub: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const child = await prisma.user.findUnique({ where: { npub: childNpub } });
  if (!child) return { ok: false, reason: "Child not found" };

  const pending = child.pendingParentRequests || [];
  if (!pending.includes(parentNpub)) {
    return { ok: false, reason: "No pending request from this parent" };
  }

  if (accept) {
    if (child.parentNpub) {
      return { ok: false, reason: "Already linked to a parent." };
    }

    await prisma.user.update({
      where: { npub: childNpub },
      data: {
        parentNpub,
        isChild: true,
        pendingParentRequests: pending.filter((p) => p !== parentNpub),
      },
    });
  } else {
    await prisma.user.update({
      where: { npub: childNpub },
      data: {
        pendingParentRequests: pending.filter((p) => p !== parentNpub),
      },
    });
  }

  return { ok: true };
}

export async function unlinkParent(
  childNpub: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const child = await prisma.user.findUnique({ where: { npub: childNpub } });
  if (!child) return { ok: false, reason: "Child not found" };
  if (!child.parentNpub || !child.isChild) {
    return { ok: false, reason: "This account is not linked to a parent." };
  }

  await prisma.user.update({
    where: { npub: childNpub },
    data: {
      parentNpub: null,
      isChild: false,
    },
  });
  return { ok: true };
}

export async function unlinkChildByParent(
  parentNpub: string,
  childNpub: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const child = await prisma.user.findUnique({ where: { npub: childNpub } });
  if (!child) return { ok: false, reason: "Child not found" };
  if (child.parentNpub !== parentNpub) {
    return { ok: false, reason: "Not authorized to unlink this child." };
  }
  await prisma.user.update({
    where: { npub: childNpub },
    data: {
      parentNpub: null,
      isChild: false,
    },
  });
  return { ok: true };
}

/**
 * Gets all enabled users with their subscriptions for cron job processing
 */
export async function getEnabledUsersWithSubscriptions() {
  return await prisma.user.findMany({
    where: {
      isEnabled: true,
    },
    include: {
      Subscription: {
        include: {
          Plan: true,
        },
      },
    },
  });
}

/**
 * Disables a user account
 */
export async function disableUserAccount(userId: string): Promise<User> {
  return await prisma.user.update({
    where: { id: userId },
    data: { isEnabled: false },
  });
}

// Muted List Management Functions

/**
 * Updates the user's muted list from Nostr
 * @param userId - The user's ID
 * @param mutedList - Object containing muted npubs and sync timestamp
 */
export async function updateUserMutedList(
  userId: string,
  mutedList: { npubs: string[]; lastSynced: string },
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      mutedList: mutedList,
    },
  });
}

/**
 * Gets the user's muted list
 * @param userId - The user's ID
 * @returns The muted list object or null
 */
export async function getUserMutedList(userId: string): Promise<{
  npubs: string[];
  lastSynced: string;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mutedList: true },
  });

  if (!user?.mutedList) {
    return null;
  }

  // Handle JSON parsing
  const mutedList = user.mutedList as any;
  return {
    npubs: mutedList.npubs || [],
    lastSynced: mutedList.lastSynced || new Date().toISOString(),
  };
}

/**
 * Updates the filterMuted setting
 * @param userId - The user's ID
 * @param filterMuted - Whether to filter muted users
 */
export async function updateUserFilterMuted(
  userId: string,
  filterMuted: boolean,
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      filterMuted: filterMuted,
    },
  });
}

/**
 * Gets the filterMuted setting
 * @param userId - The user's ID
 * @returns Whether muted filtering is enabled
 */
export async function getUserFilterMuted(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { filterMuted: true },
  });
  return user?.filterMuted || false;
}

/**
 * Updates the hidePostsFromLowTrustUsers setting
 * @param userId - The user's ID
 * @param hidePostsFromLowTrustUsers - Whether to hide posts from low trust users
 */
export async function updateUserHidePostsFromLowTrustUsers(
  userId: string,
  hidePostsFromLowTrustUsers: boolean,
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      hidePostsFromLowTrustUsers: hidePostsFromLowTrustUsers,
    },
  });
}

/**
 * Gets the hidePostsFromLowTrustUsers setting
 * @param userId - The user's ID
 * @returns Whether hiding posts from low trust users is enabled
 */
export async function getUserHidePostsFromLowTrustUsers(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hidePostsFromLowTrustUsers: true },
  });
  return user?.hidePostsFromLowTrustUsers || false;
}

// --- Route Helper Functions (moved from routes to centralize Prisma operations) ---

/**
 * Gets basic user info (npub, isChild, parentNpub) by userId
 */
export async function getUserBasicInfo(
  userId: string,
): Promise<{ npub: string | null; isChild: boolean; parentNpub: string | null } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { npub: true, isChild: true, parentNpub: true },
  });
  if (!user) return null;
  return {
    npub: user.npub,
    isChild: user.isChild,
    parentNpub: user.parentNpub,
  };
}

/**
 * Gets users by an array of npubs with their profile info
 */
export async function getUsersByNpubs(
  npubs: string[],
): Promise<Array<{ npub: string; nostrProfile: any }>> {
  if (!npubs.length) return [];
  return prisma.user.findMany({
    where: { npub: { in: npubs } },
    select: { npub: true, nostrProfile: true },
  });
}

/**
 * Gets a user by npub with their profile info
 */
export async function getUserByNpubWithProfile(
  npub: string,
): Promise<{ npub: string; nostrProfile: any } | null> {
  return prisma.user.findUnique({
    where: { npub },
    select: { npub: true, nostrProfile: true },
  });
}

/**
 * Gets user id by npub
 */
export async function getUserIdByNpub(npub: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { npub },
    select: { id: true },
  });
  return user?.id || null;
}

/**
 * Counts total users in the database (used for healthcheck)
 */
export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

/**
 * Gets a queue type by ID for a specific user
 */
export async function getQueueTypeByIdForUser(
  userId: string,
  queueTypeId: string,
): Promise<QueueType | null> {
  return prisma.queueType.findFirst({
    where: {
      id: queueTypeId,
      userId: userId,
    },
  });
}

/**
 * Gets a queue type by name for a specific user
 */
export async function getQueueTypeByNameForUser(
  userId: string,
  queueTypeName: string,
): Promise<{ id: string } | null> {
  return prisma.queueType.findFirst({
    where: {
      userId,
      name: queueTypeName,
    },
    select: {
      id: true,
    },
  });
}

/**
 * Checks if a hashtag preset exists for a user
 */
export async function hashTagPresetExistsForUser(
  userId: string,
  presetId: string,
): Promise<boolean> {
  const preset = await prisma.hashTagPreset.findFirst({
    where: {
      id: presetId,
      userId: userId,
    },
  });
  return !!preset;
}
