import type { ProfileData } from "~/features/nostr/types";
import type { User } from "~/features/user/data/user-prisma-types.server";
import {
  findUsersForParentChildSearch,
  findUserByNpubForParentChild,
  updateUserPendingParentRequestsPush,
  updateUserPendingParentRequests,
  findConfirmedChildrenForParent,
  findPendingChildrenForParent,
  findPendingParentRequestsForChild,
  updateUserAcceptChildLink,
  updateUserRejectChildLink,
  updateUserUnlinkChild,
} from "~/features/user/repositories/parent-child-data.server";
import { logWarning, logError } from "~/lib/error-logger.server";

const ERROR_CHILD_NOT_FOUND = "Child not found";

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
      const parsed = JSON.parse(nostrProfile) as {
        name?: string;
        display_name?: string;
        picture?: string;
      };
      return {
        name: parsed.name,
        display_name: parsed.display_name,
        picture: parsed.picture,
      };
    }
    if (typeof nostrProfile === "object") {
      return {
        name: nostrProfile.name,
        display_name: nostrProfile.display_name,
        picture: nostrProfile.picture,
      };
    }
  } catch {
    // Ignore parsing errors, return empty object
  }
  return {};
}

/**
 * Searches users by profile name or npub
 * Used for parent/child account linking
 */
export async function searchUsersByProfileName(
  query: string,
  excludeNpub?: string,
  limit = 20
): Promise<
  Array<
    MinimalUser & {
      profileName?: string;
      profileDisplayName?: string;
      profilePicture?: string;
    }
  >
> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Broad prefilter to avoid full table scan; then filter in app
  const fetched = await findUsersForParentChildSearch(
    excludeNpub,
    trimmed,
    200
  );

  const lowered = trimmed.toLowerCase();
  const filtered = fetched
    .map((u) => {
      const profile =
        u.nostrProfile &&
        typeof u.nostrProfile === "object" &&
        !Array.isArray(u.nostrProfile)
          ? (u.nostrProfile as ProfileData)
          : null;
      const bits = extractProfileBits(profile);
      const name = bits.name ?? bits.display_name ?? "";
      return {
        id: u.id,
        npub: u.npub,
        nostrProfile: profile,
        isChild: u.isChild || false,
        parentNpub: u.parentNpub,
        pendingParentRequests: u.pendingParentRequests,
        profileName: bits.name,
        profileDisplayName: bits.display_name,
        profilePicture: bits.picture,
        _match:
          u.npub.toLowerCase().includes(lowered) ||
          name.toLowerCase().includes(lowered),
      };
    })
    .filter((u) => u._match)
    .slice(0, limit)
    .map(({ _match, ...rest }) => rest);

  return filtered as Array<
    MinimalUser & {
      profileName?: string;
      profileDisplayName?: string;
      profilePicture?: string;
    }
  >;
}

/**
 * Requests to link a child account to a parent account
 */
export async function requestChildLink(
  parentHex: string,
  childHex: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Directly use 64-char hex keys, no normalization or conversion.
  const parent = parentHex.trim();
  const child = childHex.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(parent) || !/^[0-9a-fA-F]{64}$/.test(child)) {
    logWarning("[requestChildLink] Invalid hex key(s)", { parent, child });
    return Promise.resolve({
      ok: false,
      reason: "Invalid hex public key provided.",
    });
  }

  if (parent === child) {
    logWarning("[requestChildLink] Attempt to add self as child", { parent });
    return Promise.resolve({
      ok: false,
      reason: "You cannot add yourself as a child.",
    });
  }

  const childUser = await findUserByNpubForParentChild(child);
  if (!childUser) {
    logError(new Error("[requestChildLink] Child account not found in DB"), {
      child,
    });
    return Promise.resolve({ ok: false, reason: "Child account not found." });
  }

  if (childUser.parentNpub) {
    logWarning("[requestChildLink] Child already linked to a parent", {
      parentNpub: childUser.parentNpub,
      child: childUser.npub,
    });
    return { ok: false, reason: "This account is already linked to a parent." };
  }

  const alreadyRequested = childUser.pendingParentRequests.includes(parent);
  if (alreadyRequested) {
    return { ok: true };
  }

  await updateUserPendingParentRequestsPush(childUser.npub, parent);

  return { ok: true };
}

/**
 * Cancels a pending child link request
 */
export async function cancelChildLinkRequest(
  parentHex: string,
  childHex: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parent = parentHex.trim();
  const child = childHex.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(parent) || !/^[0-9a-fA-F]{64}$/.test(child)) {
    return Promise.resolve({
      ok: false,
      reason: "Invalid hex public key provided.",
    });
  }

  const childUser = await findUserByNpubForParentChild(child);
  if (!childUser)
    return Promise.resolve({ ok: false, reason: "Child account not found." });

  const pending = childUser.pendingParentRequests;
  if (!pending.includes(parent)) {
    return Promise.resolve({
      ok: false,
      reason: "No pending request to cancel.",
    });
  }

  await updateUserPendingParentRequests(
    child,
    pending.filter((p) => p !== parent)
  );

  return Promise.resolve({ ok: true });
}

/**
 * Gets all confirmed children for a parent account
 */
export async function getConfirmedChildrenForParent(parentNpub: string) {
  return findConfirmedChildrenForParent(parentNpub);
}

/**
 * Gets all pending child requests for a parent account
 */
export async function getPendingChildrenForParent(parentNpub: string) {
  return findPendingChildrenForParent(parentNpub);
}

/**
 * Gets all pending parent requests for a child account
 */
export async function getPendingParentRequestsForChild(childNpub: string) {
  return findPendingParentRequestsForChild(childNpub);
}

/**
 * Responds to a child link request (accept or reject)
 */
export async function respondToChildRequest(
  childNpub: string,
  parentNpub: string,
  accept: boolean
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const child = await findUserByNpubForParentChild(childNpub);
  if (!child) return { ok: false, reason: ERROR_CHILD_NOT_FOUND };

  const pending = child.pendingParentRequests;
  if (!pending.includes(parentNpub)) {
    return { ok: false, reason: "No pending request from this parent" };
  }

  const newPending = pending.filter((p) => p !== parentNpub);
  if (accept) {
    if (child.parentNpub) {
      return { ok: false, reason: "Already linked to a parent." };
    }
    await updateUserAcceptChildLink(childNpub, parentNpub, newPending);
  } else {
    await updateUserRejectChildLink(childNpub, newPending);
  }

  return { ok: true };
}

/**
 * Unlinks a child account from its parent (child-initiated)
 */
export async function unlinkParent(
  childNpub: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const child = await findUserByNpubForParentChild(childNpub);
  if (!child) return { ok: false, reason: ERROR_CHILD_NOT_FOUND };
  if (!child.parentNpub || !child.isChild) {
    return { ok: false, reason: "This account is not linked to a parent." };
  }

  await updateUserUnlinkChild(childNpub);
  return { ok: true };
}

/**
 * Unlinks a child account from its parent (parent-initiated)
 */
export async function unlinkChildByParent(
  parentNpub: string,
  childNpub: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const child = await findUserByNpubForParentChild(childNpub);
  if (!child) return { ok: false, reason: ERROR_CHILD_NOT_FOUND };
  if (child.parentNpub !== parentNpub) {
    return { ok: false, reason: "Not authorized to unlink this child." };
  }
  await updateUserUnlinkChild(childNpub);
  return { ok: true };
}
