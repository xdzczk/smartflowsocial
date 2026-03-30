import { type BroadcastAudienceType } from "@prisma/client";

import { resolveAudiencePubkeys } from "~/features/broadcast/broadcast-resolve.server";
import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";

import {
  BroadcastActionError,
  MSG_FOLLOWERS_AUDIENCE_REMOVED,
  MSG_FOLLOWING_AUDIENCE_REMOVED,
  MSG_SAVED_AUDIENCE_NOT_FOUND,
} from "./broadcast-actions-shared.server";

export async function listBroadcastSavedAudiences(userId: string) {
  return prisma.broadcastSavedAudience.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createBroadcastSavedAudience(
  userId: string,
  input: {
    name: string;
    audienceType: BroadcastAudienceType;
    customNpubLines: string[];
    ruleSummary?: string;
  }
) {
  if (input.audienceType === "FOLLOWING") {
    throw new BroadcastActionError(MSG_FOLLOWING_AUDIENCE_REMOVED, "AUDIENCE");
  }
  if (input.audienceType === "FOLLOWERS") {
    throw new BroadcastActionError(MSG_FOLLOWERS_AUDIENCE_REMOVED, "AUDIENCE");
  }
  return prisma.broadcastSavedAudience.create({
    data: {
      userId,
      name: input.name,
      audienceType: input.audienceType,
      customNpubLines: input.customNpubLines,
      ruleSummary: input.ruleSummary ?? null,
    },
  });
}

export async function deleteBroadcastSavedAudience(
  userId: string,
  id: string
): Promise<void> {
  const row = await prisma.broadcastSavedAudience.findFirst({
    where: { id, userId },
  });
  if (!row) {
    throw new BroadcastActionError(MSG_SAVED_AUDIENCE_NOT_FOUND, "NOT_FOUND");
  }
  await prisma.broadcastSavedAudience.delete({ where: { id } });
}

export async function updateBroadcastSavedAudience(
  userId: string,
  id: string,
  input: {
    name: string;
    audienceType: BroadcastAudienceType;
    customNpubLines: string[];
    ruleSummary?: string | null;
  }
) {
  if (input.audienceType === "FOLLOWING") {
    throw new BroadcastActionError(MSG_FOLLOWING_AUDIENCE_REMOVED, "AUDIENCE");
  }
  if (input.audienceType === "FOLLOWERS") {
    throw new BroadcastActionError(MSG_FOLLOWERS_AUDIENCE_REMOVED, "AUDIENCE");
  }
  const row = await prisma.broadcastSavedAudience.findFirst({
    where: { id, userId },
  });
  if (!row) {
    throw new BroadcastActionError(MSG_SAVED_AUDIENCE_NOT_FOUND, "NOT_FOUND");
  }
  return prisma.broadcastSavedAudience.update({
    where: { id },
    data: {
      name: input.name,
      audienceType: input.audienceType,
      customNpubLines: input.customNpubLines,
      ruleSummary: input.ruleSummary ?? null,
    },
  });
}

export async function duplicateBroadcastSavedAudience(
  userId: string,
  id: string
): Promise<{ id: string }> {
  const row = await prisma.broadcastSavedAudience.findFirst({
    where: { id, userId },
  });
  if (!row) {
    throw new BroadcastActionError(MSG_SAVED_AUDIENCE_NOT_FOUND, "NOT_FOUND");
  }
  if (row.audienceType === "FOLLOWING") {
    throw new BroadcastActionError(MSG_FOLLOWING_AUDIENCE_REMOVED, "AUDIENCE");
  }
  if (row.audienceType === "FOLLOWERS") {
    throw new BroadcastActionError(MSG_FOLLOWERS_AUDIENCE_REMOVED, "AUDIENCE");
  }
  const created = await prisma.broadcastSavedAudience.create({
    data: {
      userId,
      name: `${row.name} (copy)`,
      audienceType: row.audienceType,
      customNpubLines: row.customNpubLines,
      ruleSummary: row.ruleSummary,
    },
  });
  return { id: created.id };
}

export async function refreshSavedAudienceEstimate(
  userId: string,
  id: string
): Promise<{ size: number }> {
  const row = await prisma.broadcastSavedAudience.findFirst({
    where: { id, userId },
  });
  if (!row) {
    throw new BroadcastActionError(MSG_SAVED_AUDIENCE_NOT_FOUND, "NOT_FOUND");
  }
  const user = await getUserById(userId);
  if (!user?.npub) {
    throw new BroadcastActionError("User npub missing", "USER");
  }
  const { nostrAdapter } = await import("~/lib/nostr-adapter.server");
  const senderHex = nostrAdapter.decodeNpub(user.npub) ?? user.npub;
  if (!/^[0-9a-f]{64}$/i.test(senderHex)) {
    throw new BroadcastActionError("Invalid account pubkey", "USER");
  }

  let size = 0;
  if (row.audienceType === "CUSTOM") {
    const { pubkeys, graphFetchFailed } = await resolveAudiencePubkeys({
      audienceType: "CUSTOM",
      customLines: row.customNpubLines,
      senderPubkeyHex: senderHex.toLowerCase(),
    });
    if (graphFetchFailed) {
      throw new BroadcastActionError(
        "Could not load your follower list to estimate this audience. Try again in a few minutes.",
        "GRAPH_CACHE"
      );
    }
    size = pubkeys.length;
  } else {
    const { pubkeys } = await resolveAudiencePubkeys({
      audienceType: row.audienceType,
      customLines: row.customNpubLines,
      senderPubkeyHex: senderHex.toLowerCase(),
    });
    size = pubkeys.length;
  }

  await prisma.broadcastSavedAudience.update({
    where: { id },
    data: { lastResolvedSize: size },
  });
  return { size };
}
