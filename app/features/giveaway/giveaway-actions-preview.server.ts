import type { Prisma } from "./data/giveaway-prisma-types.server";
import { getGiveawayById } from "./giveaway-actions-crud.server";
import {
  eligibleAccountCountForPreviewMeta,
  getEligibleParticipantsForGiveaway,
  runSelectionForGiveaway,
} from "./giveaway-actions-eligibility.server";
import { ERROR_GIVEAWAY_NOT_FOUND } from "./giveaway-actions-shared.server";
import { appendGiveawayActivityLog } from "./giveaway-activity-log.server";
import { updateGiveaway as updateGiveawayRow } from "./repositories/giveaway-actions-data.server";
import type { GiveawayWinnerEntry } from "./types";

export async function previewGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ winners: GiveawayWinnerEntry[]; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { winners: [], error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "DRAFT" && g.status !== "PREVIEWED")
    return { winners: [], error: "Giveaway cannot be previewed" };

  const { relatedEvents } = await getEligibleParticipantsForGiveaway(userId, g);
  const winners = runSelectionForGiveaway(g, relatedEvents);

  const eligibleAccountCount = eligibleAccountCountForPreviewMeta(
    g,
    relatedEvents
  );

  const lastPreviewMeta = {
    eligiblePoolSize: eligibleAccountCount,
    computedAt: new Date().toISOString(),
    selectionMode: g.selectionMode,
    filters: g.filters ?? null,
  };

  await updateGiveawayRow(giveawayId, {
    status: "PREVIEWED",
    winnerSnapshot: winners as unknown as Prisma.InputJsonValue,
    lastPreviewMeta: lastPreviewMeta,
    activityLog: appendGiveawayActivityLog(g.activityLog, "preview_generated", {
      eligiblePoolSize: eligibleAccountCount,
      winnersDrawn: winners.length,
    }),
  });

  return { winners };
}

export async function rerollGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ winners: GiveawayWinnerEntry[]; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { winners: [], error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED")
    return { winners: [], error: "Only previewed giveaways can be rerolled" };

  const { relatedEvents } = await getEligibleParticipantsForGiveaway(userId, g);
  const winners = runSelectionForGiveaway(g, relatedEvents);

  const eligibleAccountCount = eligibleAccountCountForPreviewMeta(
    g,
    relatedEvents
  );

  const lastPreviewMeta = {
    eligiblePoolSize: eligibleAccountCount,
    computedAt: new Date().toISOString(),
    selectionMode: g.selectionMode,
    filters: g.filters ?? null,
  };

  await updateGiveawayRow(giveawayId, {
    winnerSnapshot: winners as unknown as Prisma.InputJsonValue,
    lastPreviewMeta: lastPreviewMeta,
    rerollCount: { increment: 1 },
    activityLog: appendGiveawayActivityLog(g.activityLog, "rerolled", {
      eligiblePoolSize: eligibleAccountCount,
    }),
  });

  return { winners };
}

export async function excludeWinnerAndRedraw(
  userId: string,
  giveawayId: string,
  winnerPubkey: string
): Promise<{ winners: GiveawayWinnerEntry[]; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { winners: [], error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED")
    return { winners: [], error: "Only previewed giveaways can be modified" };

  const current = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  const without = current.filter((w) => w.pubkey !== winnerPubkey);
  if (without.length === current.length)
    return { winners: current, error: "Winner not in list" };

  const { relatedEvents } = await getEligibleParticipantsForGiveaway(userId, g);
  const keepWinnerKeys = new Set(without.map((w) => w.pubkey));
  const eligibleEvents = relatedEvents.filter(
    (e) => !keepWinnerKeys.has(e.pubkey)
  );
  const updated = runSelectionForGiveaway(g, eligibleEvents);

  const prevEx =
    Array.isArray(g.excludedPubkeys) &&
    g.excludedPubkeys.every((x) => typeof x === "string")
      ? g.excludedPubkeys
      : [];
  const excludedHistory = [...new Set([...prevEx, winnerPubkey])];

  const lastPreviewMeta = {
    eligiblePoolSize: eligibleEvents.length,
    computedAt: new Date().toISOString(),
    selectionMode: g.selectionMode,
    filters: g.filters ?? null,
  };

  await updateGiveawayRow(giveawayId, {
    winnerSnapshot: updated as unknown as Prisma.InputJsonValue,
    lastPreviewMeta: lastPreviewMeta,
    excludedPubkeys: excludedHistory,
    rerollCount: { increment: 1 },
    activityLog: appendGiveawayActivityLog(g.activityLog, "winner_excluded", {
      excludedPubkey: winnerPubkey,
    }),
  });

  return { winners: updated };
}
