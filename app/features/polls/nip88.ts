/**
 * NIP-88 Polls  -  parse, build, validate, aggregate (pure).
 * @see https://nips.nostr.com/88
 */

import { v4 as uuidv4 } from "uuid";

import type { SignedEvent } from "~/features/nostr/types";

import type {
  PollDefinition,
  PollOption,
  PollTallyResult,
  PollType,
} from "./nip88.types";

const KIND_POLL = 1068;
const KIND_VOTE = 1018;

export function normalizeRelayUrls(urls: string[]): string[] {
  return Array.from(
    new Set(urls.map((u) => u.trim()).filter((u) => u.length > 0))
  );
}

/** Alphanumeric option id suitable for NIP-88 `option` tags */
export function generatePollOptionId(): string {
  return uuidv4().replace(/-/g, "");
}

export function extractRelayUrlsFromPollTags(tags: string[][]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    if (t[0] === "relay" && typeof t[1] === "string" && t[1].trim()) {
      out.push(t[1].trim());
    }
  }
  return normalizeRelayUrls(out);
}

export function parsePollTypeFromTags(tags: string[][]): PollType {
  for (const t of tags) {
    if (t[0] === "polltype" && t[1]) {
      const v = t[1].toLowerCase();
      if (v === "multiplechoice") return "multiplechoice";
      if (v === "singlechoice") return "singlechoice";
    }
  }
  return "singlechoice";
}

export function parseEndsAtFromTags(tags: string[][]): number | undefined {
  for (const t of tags) {
    if (t[0] === "endsAt" && t[1]) {
      const n = Number(t[1]);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
  }
  return undefined;
}

function parseOptionsFromTags(tags: string[][]): PollOption[] {
  const options: PollOption[] = [];
  for (const t of tags) {
    if (t[0] === "option" && t[1] && t[2] !== undefined) {
      options.push({ id: t[1], label: t[2] });
    }
  }
  return options;
}

/**
 * Parse a signed kind 1068 event into a PollDefinition, or null if invalid.
 */
export function parsePollFromSignedEvent(event: {
  id: string;
  pubkey: string;
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}): PollDefinition | null {
  if (event.kind !== KIND_POLL) return null;
  const options = parseOptionsFromTags(event.tags);
  if (options.length < 2) return null;
  const relayUrls = extractRelayUrlsFromPollTags(event.tags);
  if (relayUrls.length === 0) return null;
  const question = event.content.trim();
  if (!question) return null;

  return {
    id: event.id,
    pubkey: event.pubkey,
    question,
    options,
    pollType: parsePollTypeFromTags(event.tags),
    endsAt: parseEndsAtFromTags(event.tags),
    relayUrls,
    createdAt: event.created_at,
  };
}

export interface BuildPollTagsInput {
  optionLabels: string[];
  pollType: PollType;
  relayUrls: string[];
  /** Unix seconds; omit for no expiry */
  endsAt?: number;
  /** Extra tags e.g. hashtag [["t","foo"]] */
  extraTags?: string[][];
}

/**
 * Build tag array for kind 1068 (order: options, relay, polltype, endsAt, extras).
 */
export function buildPollTags(input: BuildPollTagsInput): string[][] {
  const labels = input.optionLabels
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (labels.length < 2) {
    throw new Error("NIP-88 poll requires at least two non-empty options");
  }
  const relays = normalizeRelayUrls(input.relayUrls);
  if (relays.length === 0) {
    throw new Error("NIP-88 poll requires at least one relay URL");
  }

  const tags: string[][] = [];
  for (const label of labels) {
    tags.push(["option", generatePollOptionId(), label]);
  }
  for (const url of relays) {
    tags.push(["relay", url]);
  }
  tags.push(["polltype", input.pollType]);
  if (input.endsAt !== undefined && Number.isFinite(input.endsAt)) {
    tags.push(["endsAt", String(Math.floor(input.endsAt))]);
  }
  if (input.extraTags?.length) {
    tags.push(...input.extraTags);
  }
  return tags;
}

export function getPollRootEventIdFromVoteTags(
  tags: string[][]
): string | null {
  for (const t of tags) {
    if (t[0] === "e" && t[1]) return t[1];
  }
  return null;
}

export function getResponseOptionIdsFromVoteTags(tags: string[][]): string[] {
  const ids: string[] = [];
  for (const t of tags) {
    if (t[0] === "response" && t[1]) ids.push(t[1]);
  }
  return ids;
}

/**
 * Apply NIP-88 response tag rules for one vote event.
 */
export function effectiveVoteOptionIds(
  rawResponseIds: string[],
  pollType: PollType
): string[] {
  if (rawResponseIds.length === 0) return [];
  if (pollType === "singlechoice") {
    return rawResponseIds[0] ? [rawResponseIds[0]] : [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of rawResponseIds) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

const optionIdSet = (poll: PollDefinition): Set<string> =>
  new Set(poll.options.map((o) => o.id));

export interface ValidateVoteResult {
  ok: boolean;
  error?: string;
}

/**
 * Structural validation: vote kind 1018 references poll and only uses valid option ids;
 * optional `nowSec` for expiry check on vote timestamp.
 */
export function validateVoteAgainstPoll(
  vote: Pick<SignedEvent, "kind" | "tags" | "created_at">,
  poll: Pick<
    SignedEvent,
    "id" | "pubkey" | "kind" | "tags" | "content" | "created_at"
  >,
  nowSec?: number
): ValidateVoteResult {
  if (poll.kind !== KIND_POLL) {
    return { ok: false, error: "pollEvent is not kind 1068" };
  }
  if (vote.kind !== KIND_VOTE) {
    return { ok: false, error: "vote is not kind 1018" };
  }
  const root = getPollRootEventIdFromVoteTags(vote.tags);
  if (!root || root !== poll.id) {
    return { ok: false, error: "vote e-tag does not reference poll id" };
  }

  const parsed = parsePollFromSignedEvent({
    id: poll.id,
    pubkey: poll.pubkey,
    kind: poll.kind,
    content: poll.content,
    tags: poll.tags,
    created_at: poll.created_at,
  });
  if (!parsed) {
    return { ok: false, error: "invalid poll event" };
  }

  const allowed = optionIdSet(parsed);
  const raw = getResponseOptionIdsFromVoteTags(vote.tags);
  const effective = effectiveVoteOptionIds(raw, parsed.pollType);
  for (const id of effective) {
    if (!allowed.has(id)) {
      return { ok: false, error: "vote references unknown option id" };
    }
  }
  if (effective.length === 0) {
    return { ok: false, error: "vote has no valid response tags" };
  }

  if (parsed.endsAt !== undefined && vote.created_at > parsed.endsAt) {
    return { ok: false, error: "vote is after poll endsAt" };
  }

  const t = nowSec ?? Math.floor(Date.now() / 1000);
  if (parsed.endsAt !== undefined && t > parsed.endsAt) {
    // Poll already closed  -  still allow publishing historical sync; clients disable UI.
    // Server may reject if policy requires; we only validate event consistency here.
  }

  return { ok: true };
}

/** Minimal event shape for aggregation (nostr-tools Event compatible) */
export interface VoteEventLike {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
}

/**
 * NIP-88 counting: latest vote per pubkey (within endsAt), then apply polltype response rules.
 */
export function aggregatePollVotes(
  voteEvents: VoteEventLike[],
  poll: PollDefinition
): PollTallyResult {
  const counts: Record<string, number> = {};
  for (const o of poll.options) counts[o.id] = 0;

  const byKind = voteEvents.filter((e) => e.kind === KIND_VOTE);
  const forPoll = byKind.filter(
    (e) => getPollRootEventIdFromVoteTags(e.tags) === poll.id
  );

  const latestByPubkey = new Map<string, VoteEventLike>();
  for (const ev of forPoll) {
    if (poll.endsAt !== undefined && ev.created_at > poll.endsAt) {
      continue;
    }
    const prev = latestByPubkey.get(ev.pubkey);
    if (!prev || ev.created_at > prev.created_at) {
      latestByPubkey.set(ev.pubkey, ev);
    }
  }

  const allowed = optionIdSet(poll);
  let contributingVoters = 0;
  for (const ev of latestByPubkey.values()) {
    const raw = getResponseOptionIdsFromVoteTags(ev.tags);
    const effective = effectiveVoteOptionIds(raw, poll.pollType);
    let contributed = false;
    for (const id of effective) {
      if (allowed.has(id)) {
        counts[id] = (counts[id] ?? 0) + 1;
        contributed = true;
      }
    }
    if (contributed) contributingVoters += 1;
  }

  return {
    counts,
    totalVoters: contributingVoters,
  };
}

export { KIND_POLL, KIND_VOTE };
