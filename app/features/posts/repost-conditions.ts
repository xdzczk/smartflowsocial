import { DEFAULT_USER_WRITE_RELAYS } from "~/features/relays/relay-constants";

import type { RepostConditions } from "./types";

/**
 * Primal's `likes` stat only counts reactions whose content is empty or starts
 * with +, 🤙, or ❤️. Emoji and custom emoji are still kind 7 reactions.
 */
export interface ReactionEvent {
  id: string;
  kind: number;
  tags?: unknown;
}

export interface RepostConditionStats {
  likes: number;
  zaps: number;
  replies: number;
  reposts: number;
  satszapped: number;
}

function otherConditionStat(
  key: string
): keyof RepostConditionStats | undefined {
  if (key === "minZaps") return "zaps";
  if (key === "minComments") return "replies";
  if (key === "minReposts") return "reposts";
  if (key === "minSats") return "satszapped";
  return undefined;
}

const MAX_REACTION_RELAYS = 20;

function isRelayUrl(value: string): boolean {
  return value.startsWith("wss://") || value.startsWith("ws://");
}

function targetsEvent(tags: unknown, eventId: string): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some(
    (tag) => Array.isArray(tag) && tag[0] === "e" && tag[1] === eventId
  );
}

/** Unique kind 7 events that tag the source note. Content is not filtered. */
export function countKind7Reactions(
  events: ReactionEvent[],
  eventId: string
): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.kind !== 7 || event.id.length === 0) continue;
    if (!targetsEvent(event.tags, eventId)) continue;
    ids.add(event.id);
  }
  return ids.size;
}

/**
 * Relay results include emoji. Primal likes are a floor for the same note,
 * so a partial relay response cannot undercut reactions we already know about.
 * `countedOnRelays` is null when the relay query failed.
 */
export function reactionsTowardMinimum(input: {
  countedOnRelays: number | null;
  primalLikes: number;
}): number {
  if (input.countedOnRelays == null) return input.primalLikes;
  return Math.max(input.countedOnRelays, input.primalLikes);
}

export function relaysForReactionCount(relays: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const relay of [...relays, ...DEFAULT_USER_WRITE_RELAYS]) {
    const url = relay.trim();
    if (!isRelayUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_REACTION_RELAYS) break;
  }
  return out;
}

export function repostConditionsMet(input: {
  conditions: RepostConditions;
  stats: RepostConditionStats | undefined;
  countedReactions: number | null;
}): boolean {
  for (const [key, minVal] of Object.entries(input.conditions)) {
    if (typeof minVal !== "number") continue;
    if (key === "minReactions") {
      if (input.countedReactions == null && input.stats == null) return false;
      const actual = reactionsTowardMinimum({
        countedOnRelays: input.countedReactions,
        primalLikes: input.stats?.likes ?? 0,
      });
      if (actual < minVal) return false;
      continue;
    }
    const statsKey = otherConditionStat(key);
    if (!statsKey) continue;
    if (input.stats == null) return false;
    if (input.stats[statsKey] < minVal) return false;
  }
  return true;
}
