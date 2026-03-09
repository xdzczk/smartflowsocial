/**
 * Parent/child account linking data access. All prisma.user findMany, findUnique,
 * and update calls for parent-child live here. Prisma confined to this file.
 */

import { prisma } from "~/lib/prisma.server";

/** Row shape returned by findUsersForParentChildSearch */
export interface ParentChildSearchRow {
  id: string;
  npub: string;
  nostrProfile: unknown;
  isChild: boolean;
  parentNpub: string | null;
  pendingParentRequests: string[];
}

/** Row shape returned by findConfirmedChildrenForParent */
export interface ConfirmedChildRow {
  id: string;
  npub: string;
  nostrProfile: unknown;
  isChild: boolean;
}

/** Row shape returned by findPendingChildrenForParent */
export interface PendingChildRow {
  id: string;
  npub: string;
  nostrProfile: unknown;
}

/**
 * Broad prefilter for parent/child search; service filters in app.
 */
export function findUsersForParentChildSearch(
  excludeNpub: string | undefined,
  trimmed: string,
  take: number
): Promise<ParentChildSearchRow[]> {
  return prisma.user.findMany({
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
    take,
    select: {
      id: true,
      npub: true,
      nostrProfile: true,
      isChild: true,
      parentNpub: true,
      pendingParentRequests: true,
    },
  });
}

/**
 * Find user by npub (full row for parent/child logic).
 */
export function findUserByNpubForParentChild(npub: string): Promise<{
  id: string;
  npub: string;
  parentNpub: string | null;
  isChild: boolean;
  pendingParentRequests: string[];
} | null> {
  return prisma.user.findUnique({
    where: { npub },
    select: {
      id: true,
      npub: true,
      parentNpub: true,
      isChild: true,
      pendingParentRequests: true,
    },
  });
}

/**
 * Push a parent hex onto pendingParentRequests for a user by npub.
 */
export function updateUserPendingParentRequestsPush(
  npub: string,
  parent: string
): Promise<unknown> {
  return prisma.user.update({
    where: { npub },
    data: { pendingParentRequests: { push: parent } },
  });
}

/**
 * Set pendingParentRequests to a new array for a user by npub.
 */
export function updateUserPendingParentRequests(
  npub: string,
  pendingParentRequests: string[]
): Promise<unknown> {
  return prisma.user.update({
    where: { npub },
    data: { pendingParentRequests },
  });
}

/**
 * Get all confirmed children for a parent npub.
 */
export function findConfirmedChildrenForParent(
  parentNpub: string
): Promise<ConfirmedChildRow[]> {
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
 * Get all users that have this parent in pendingParentRequests.
 */
export function findPendingChildrenForParent(
  parentNpub: string
): Promise<PendingChildRow[]> {
  return prisma.user.findMany({
    where: { pendingParentRequests: { has: parentNpub } },
    select: { id: true, npub: true, nostrProfile: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get pending parent requests for a child by npub.
 */
export async function findPendingParentRequestsForChild(
  childNpub: string
): Promise<string[]> {
  const row = await prisma.user.findUnique({
    where: { npub: childNpub },
    select: { pendingParentRequests: true },
  });
  return row?.pendingParentRequests ?? [];
}

/**
 * Accept child link: set parentNpub, isChild, and new pending array.
 */
export function updateUserAcceptChildLink(
  childNpub: string,
  parentNpub: string,
  pendingParentRequests: string[]
): Promise<unknown> {
  return prisma.user.update({
    where: { npub: childNpub },
    data: {
      parentNpub,
      isChild: true,
      pendingParentRequests,
    },
  });
}

/**
 * Reject child link: only update pendingParentRequests.
 */
export function updateUserRejectChildLink(
  childNpub: string,
  pendingParentRequests: string[]
): Promise<unknown> {
  return prisma.user.update({
    where: { npub: childNpub },
    data: { pendingParentRequests },
  });
}

/**
 * Unlink child from parent: clear parentNpub and isChild.
 */
export function updateUserUnlinkChild(childNpub: string): Promise<unknown> {
  return prisma.user.update({
    where: { npub: childNpub },
    data: { parentNpub: null, isChild: false },
  });
}
