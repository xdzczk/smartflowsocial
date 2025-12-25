import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";
import type { ProfileData } from "~/features/nostr/types";

type MinimalUser = Pick<User, "id" | "npub"> & {
  nostrProfile?: ProfileData | null;
  isChild?: boolean;
  parentNpub?: string | null;
  pendingParentRequests?: string[];
};

function extractProfileBits(nostrProfile: ProfileData | null | undefined): {
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
        name: nostrProfile?.name,
        display_name: nostrProfile?.display_name,
        picture: nostrProfile?.picture,
      };
    }
  } catch { }
  return {};
}

/**
 * Searches users by profile name or npub
 * Used for parent/child account linking
 */
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
            { nostrProfile: { not: { equals: null } } },
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

/**
 * Requests to link a child account to a parent account
 */
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

/**
 * Cancels a pending child link request
 */
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

/**
 * Gets all confirmed children for a parent account
 */
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

/**
 * Gets all pending child requests for a parent account
 */
export async function getPendingChildrenForParent(parentNpub: string) {
  return prisma.user.findMany({
    where: { pendingParentRequests: { has: parentNpub } },
    select: { id: true, npub: true, nostrProfile: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Gets all pending parent requests for a child account
 */
export async function getPendingParentRequestsForChild(childNpub: string) {
  const child = await prisma.user.findUnique({
    where: { npub: childNpub },
    select: { pendingParentRequests: true },
  });
  return child?.pendingParentRequests ?? [];
}

/**
 * Responds to a child link request (accept or reject)
 */
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

/**
 * Unlinks a child account from its parent (child-initiated)
 */
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

/**
 * Unlinks a child account from its parent (parent-initiated)
 */
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

