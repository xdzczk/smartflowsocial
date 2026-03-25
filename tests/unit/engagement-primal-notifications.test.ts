import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/cache", () => ({
  fetchFromCache: vi.fn(),
}));

import { fetchFromCache } from "~/features/cache";
import {
  buildGlobalMentionNotificationsFromPrimal,
  extractQuoteRepostEventsFromPrimal,
  flattenPrimalNotificationItems,
  isPrimalItemQuoteRepostMentioningUser,
  loadPrimalGetNotificationsResult,
} from "~/features/engagement/services/engagement-primal-notifications.server";

const USER_PK = `${"11".repeat(32)}`;
const AUTHOR_PK = `${"22".repeat(32)}`;
const NOTE_ID = `${"33".repeat(32)}`;
const QUOTED_ID = `${"44".repeat(32)}`;

function kind1Event(payload: {
  id: string;
  pubkey: string;
  content: string;
  tags: string[][];
  created_at?: number;
}) {
  return {
    kind: 1,
    created_at: payload.created_at ?? 1000,
    ...payload,
  };
}

describe("engagement-primal-notifications", () => {
  beforeEach(() => {
    vi.mocked(fetchFromCache).mockReset();
    vi.unstubAllEnvs();
  });

  describe("loadPrimalGetNotificationsResult", () => {
    it("returns failure envelope when fetch rejects", async () => {
      vi.mocked(fetchFromCache).mockRejectedValue(new Error("network"));
      const r = await loadPrimalGetNotificationsResult({
        pubkey: `${"aa".repeat(32)}`,
        limit: 10,
      });
      expect(r.getNotificationsFailed).toBe(true);
      expect(r.data).toEqual([]);
      expect(r.primalNotificationsSkipped).toBe(false);
    });

    it("skips Primal call when MENTIONS_USE_PRIMAL_GET_NOTIFICATIONS is false", async () => {
      vi.stubEnv("MENTIONS_USE_PRIMAL_GET_NOTIFICATIONS", "false");
      const r = await loadPrimalGetNotificationsResult({
        pubkey: `${"bb".repeat(32)}`,
        limit: 10,
      });
      expect(r.primalNotificationsSkipped).toBe(true);
      expect(r.getNotificationsFailed).toBe(false);
      expect(fetchFromCache).not.toHaveBeenCalled();
    });
  });

  describe("flattenPrimalNotificationItems", () => {
    it("unwraps { notifications: [...] }", () => {
      const row = kind1Event({
        id: NOTE_ID,
        pubkey: AUTHOR_PK,
        content: "hi",
        tags: [["p", USER_PK]],
      });
      expect(
        flattenPrimalNotificationItems([{ notifications: [row] }])
      ).toEqual([row]);
    });

    it("returns raw array when first element is not a wrapper object", () => {
      const a = kind1Event({
        id: NOTE_ID,
        pubkey: AUTHOR_PK,
        content: "a",
        tags: [],
      });
      expect(flattenPrimalNotificationItems([a])).toEqual([a]);
    });
  });

  describe("isPrimalItemQuoteRepostMentioningUser", () => {
    it("returns false for plain @mention (p tag only, no quote e-tag)", () => {
      const item = kind1Event({
        id: NOTE_ID,
        pubkey: AUTHOR_PK,
        content: "hello",
        tags: [["p", USER_PK]],
      });
      expect(isPrimalItemQuoteRepostMentioningUser(item, USER_PK)).toBe(false);
    });

    it("returns false for thread reply with p tag (e reply marker, not quote)", () => {
      const item = kind1Event({
        id: NOTE_ID,
        pubkey: AUTHOR_PK,
        content: "reply",
        tags: [
          ["e", QUOTED_ID, "wss://r", "reply"],
          ["p", USER_PK],
        ],
      });
      expect(isPrimalItemQuoteRepostMentioningUser(item, USER_PK)).toBe(false);
    });

    it("returns true for quote repost: e mention marker + nostr ref in content", () => {
      const item = kind1Event({
        id: NOTE_ID,
        pubkey: AUTHOR_PK,
        content: "see nostr:note1qabcdef",
        tags: [
          ["e", QUOTED_ID, "wss://r", "mention"],
          ["p", USER_PK],
        ],
      });
      expect(isPrimalItemQuoteRepostMentioningUser(item, USER_PK)).toBe(true);
    });

    it("returns false for self-authored event", () => {
      const item = kind1Event({
        id: NOTE_ID,
        pubkey: USER_PK,
        content: "nostr:note1q",
        tags: [
          ["e", QUOTED_ID, "wss://r", "mention"],
          ["p", USER_PK],
        ],
      });
      expect(isPrimalItemQuoteRepostMentioningUser(item, USER_PK)).toBe(false);
    });
  });

  describe("extractQuoteRepostEventsFromPrimal", () => {
    it("does not treat plain mentions as quotes", () => {
      const data = [
        kind1Event({
          id: NOTE_ID,
          pubkey: AUTHOR_PK,
          content: "yo @you",
          tags: [["p", USER_PK]],
        }),
      ];
      expect(extractQuoteRepostEventsFromPrimal(data, USER_PK)).toEqual([]);
    });
  });

  describe("buildGlobalMentionNotificationsFromPrimal", () => {
    it("includes kind-1 that p-tags user and is not excluded", () => {
      const data = [
        kind1Event({
          id: NOTE_ID,
          pubkey: AUTHOR_PK,
          content: "hey",
          tags: [["p", USER_PK]],
        }),
      ];
      const out = buildGlobalMentionNotificationsFromPrimal(
        data,
        USER_PK,
        new Set(),
        new Set()
      );
      expect(out).toHaveLength(1);
      expect(out[0]?.eventId).toBe(NOTE_ID);
    });

    it("dedupes when event id is in excludeIds (e.g. strict quote id)", () => {
      const data = [
        kind1Event({
          id: NOTE_ID,
          pubkey: AUTHOR_PK,
          content: "hey",
          tags: [["p", USER_PK]],
        }),
      ];
      const out = buildGlobalMentionNotificationsFromPrimal(
        data,
        USER_PK,
        new Set([NOTE_ID]),
        new Set()
      );
      expect(out).toHaveLength(0);
    });
  });
});
