/**
 * Giveaway winner selection.
 * Takes eligible related events and returns ordered winners (uniform or weighted).
 */

import { nip19 } from "nostr-tools";

import type {
  GiveawayEngagementConfig,
  GiveawayEngagementType,
  GiveawayWinnerEntry,
  RelatedEvent,
} from "./types";

const KIND_TO_ENGAGEMENT: Record<number, GiveawayEngagementType> = {
  1: "COMMENT",
  6: "REPOST",
  7: "REACTION",
  9735: "ZAP",
};

const DEFAULT_WEIGHTS: Record<GiveawayEngagementType, number> = {
  REACTION: 1,
  REPOST: 2,
  COMMENT: 1.5,
  ZAP: 1,
};

export interface SelectionInput {
  relatedEvents: RelatedEvent[];
  engagementTypes: GiveawayEngagementType[];
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  engagementWeights?: Partial<Record<GiveawayEngagementType, number>>;
  winnerCount: number;
}

/**
 * Filter events to only those matching the selected engagement types.
 */
function filterByEngagementTypes(
  events: RelatedEvent[],
  engagementTypes: GiveawayEngagementType[]
): RelatedEvent[] {
  const set = new Set(engagementTypes);
  return events.filter((e) => {
    const type = KIND_TO_ENGAGEMENT[e.kind];
    return type !== undefined && set.has(type);
  });
}

/**
 * Build one entry per pubkey with all their qualifying actions (for weighting).
 */
function buildUserEntries(
  events: RelatedEvent[],
  weights: Record<GiveawayEngagementType, number>
): Map<
  string,
  {
    pubkey: string;
    actions: Array<{ kind: number; eventId: string }>;
    weight: number;
  }
> {
  const byPubkey = new Map<
    string,
    {
      pubkey: string;
      actions: Array<{ kind: number; eventId: string }>;
      weight: number;
    }
  >();
  for (const e of events) {
    const type = KIND_TO_ENGAGEMENT[e.kind];
    if (type === undefined) continue;
    const w = weights[type];
    const existing = byPubkey.get(e.pubkey);
    if (existing) {
      existing.actions.push({ kind: e.kind, eventId: e.id });
      existing.weight += w;
    } else {
      byPubkey.set(e.pubkey, {
        pubkey: e.pubkey,
        actions: [{ kind: e.kind, eventId: e.id }],
        weight: w,
      });
    }
  }
  return byPubkey;
}

/**
 * Uniform random sample of size k from array (no replacement).
 */
function sampleUniform<T>(arr: T[], k: number): T[] {
  if (k <= 0 || arr.length === 0) return [];
  if (k >= arr.length) return [...arr];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

/**
 * Weighted random sample: one entry per user, probability proportional to weight.
 * Uses cumulative weight and random draw.
 */
function sampleWeighted<T extends { weight: number }>(
  items: T[],
  k: number
): T[] {
  if (k <= 0 || items.length === 0) return [];
  if (k >= items.length) return [...items];
  let total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return sampleUniform(items, k);
  const result: T[] = [];
  const remaining = [...items];
  for (let i = 0; i < k && remaining.length > 0; i++) {
    const r = Math.random() * total;
    let acc = 0;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      const item = remaining[j];
      if (item === undefined) continue;
      acc += item.weight;
      if (r <= acc) {
        idx = j;
        break;
      }
    }
    const spliced = remaining.splice(idx, 1);
    const chosen = spliced[0];
    if (chosen === undefined) break;
    result.push(chosen);
    total -= chosen.weight;
  }
  return result;
}

function pubkeyToNpub(pubkey: string): string {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

/**
 * Run winner selection and return ordered list of winner entries.
 */
export function runGiveawaySelection(
  input: SelectionInput
): GiveawayWinnerEntry[] {
  const {
    relatedEvents,
    engagementTypes,
    selectionMode,
    engagementWeights,
    winnerCount,
  } = input;

  const filtered = filterByEngagementTypes(relatedEvents, engagementTypes);
  const weights: Record<GiveawayEngagementType, number> = {
    ...DEFAULT_WEIGHTS,
    ...engagementWeights,
  };
  const userEntries = buildUserEntries(filtered, weights);
  const entries = Array.from(userEntries.values());

  if (entries.length === 0) return [];
  const k = Math.min(winnerCount, entries.length);

  const selected =
    selectionMode === "WEIGHTED_BY_ENGAGEMENT"
      ? sampleWeighted(entries, k)
      : sampleUniform(entries, k);

  return selected.map((e) => ({
    pubkey: e.pubkey,
    npub: pubkeyToNpub(e.pubkey),
    qualifyingActions: e.actions.map((a) => ({
      kind: a.kind,
      eventId: a.eventId,
    })),
  }));
}

export interface SelectionPerEngagementInput {
  relatedEvents: RelatedEvent[];
  engagementConfig: GiveawayEngagementConfig;
  selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  engagementWeights?: Partial<Record<GiveawayEngagementType, number>>;
}

/**
 * Run winner selection per engagement type and merge by pubkey (sum sats).
 * Returns one entry per unique winner with combined sats and actions.
 */
export function runGiveawaySelectionPerEngagement(
  input: SelectionPerEngagementInput
): GiveawayWinnerEntry[] {
  const { relatedEvents, engagementConfig, selectionMode, engagementWeights } =
    input;
  const weights: Record<GiveawayEngagementType, number> = {
    ...DEFAULT_WEIGHTS,
    ...engagementWeights,
  };
  const byPubkey = new Map<
    string,
    {
      pubkey: string;
      npub: string;
      qualifyingActions: Array<{ kind: number; eventId: string }>;
      satsPerWinner: number;
    }
  >();

  const types = Object.keys(engagementConfig) as GiveawayEngagementType[];
  for (const engagementType of types) {
    const config = engagementConfig[engagementType];
    if (!config || config.winnerCount <= 0) continue;
    const filtered = filterByEngagementTypes(relatedEvents, [engagementType]);
    const userEntries = buildUserEntries(filtered, weights);
    const entries = Array.from(userEntries.values());
    if (entries.length === 0) continue;
    const k = Math.min(config.winnerCount, entries.length);
    const selected =
      selectionMode === "WEIGHTED_BY_ENGAGEMENT"
        ? sampleWeighted(entries, k)
        : sampleUniform(entries, k);
    for (const e of selected) {
      const npub = pubkeyToNpub(e.pubkey);
      const existing = byPubkey.get(e.pubkey);
      if (existing) {
        existing.qualifyingActions.push(...e.actions);
        /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- satsPerWinner optional in config */
        existing.satsPerWinner += config.satsPerWinner ?? 0;
      } else {
        byPubkey.set(e.pubkey, {
          pubkey: e.pubkey,
          npub,
          qualifyingActions: [...e.actions],
          /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- satsPerWinner optional in config */
          satsPerWinner: config.satsPerWinner ?? 0,
        });
      }
    }
  }

  return Array.from(byPubkey.values()).map((e) => ({
    pubkey: e.pubkey,
    npub: e.npub,
    qualifyingActions: e.qualifyingActions,
    satsPerWinner: e.satsPerWinner > 0 ? e.satsPerWinner : undefined,
  }));
}
