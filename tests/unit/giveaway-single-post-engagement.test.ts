/**
 * Unit tests: single-post giveaway root-only engagement filter
 */

import { describe, it, expect } from "vitest";

import {
  filterRelatedEventsToRootNoteEngagementOnly,
  kind1IsDirectReplyToRootEvent,
  kind9735TargetsEventId,
} from "~/features/giveaway/giveaway-single-post-engagement.server";
import type { RelatedEvent } from "~/features/giveaway/types";

const ROOT = "rootnote111";

describe("giveaway-single-post-engagement", () => {
  describe("kind1IsDirectReplyToRootEvent", () => {
    it("accepts NIP-10 direct reply (reply marker points at root)", () => {
      const ev: RelatedEvent = {
        id: "r1",
        pubkey: "pk",
        created_at: 1,
        kind: 1,
        tags: [
          ["e", ROOT, "", "reply"],
          ["e", ROOT, "", "root"],
        ],
      };
      expect(kind1IsDirectReplyToRootEvent(ev, ROOT)).toBe(true);
    });

    it("rejects nested reply (reply parent is a child note)", () => {
      const child = "childnote222";
      const ev: RelatedEvent = {
        id: "r2",
        pubkey: "pk",
        created_at: 1,
        kind: 1,
        tags: [
          ["e", child, "", "reply"],
          ["e", ROOT, "", "root"],
        ],
      };
      expect(kind1IsDirectReplyToRootEvent(ev, ROOT)).toBe(false);
    });

    it("accepts deprecated single e-tag reply to root", () => {
      const ev: RelatedEvent = {
        id: "r3",
        pubkey: "pk",
        created_at: 1,
        kind: 1,
        tags: [["e", ROOT]],
      };
      expect(kind1IsDirectReplyToRootEvent(ev, ROOT)).toBe(true);
    });
  });

  describe("kind9735TargetsEventId", () => {
    it("matches zap receipt with e-tag for target", () => {
      const ev: RelatedEvent = {
        id: "z1",
        pubkey: "pk",
        created_at: 1,
        kind: 9735,
        tags: [["e", ROOT]],
      };
      expect(kind9735TargetsEventId(ev, ROOT)).toBe(true);
      expect(kind9735TargetsEventId(ev, "other")).toBe(false);
    });
  });

  describe("filterRelatedEventsToRootNoteEngagementOnly", () => {
    it("keeps kind 7/6, direct kind 1, matching 9735; drops nested kind 1", () => {
      const nestedReply: RelatedEvent = {
        id: "nested",
        pubkey: "pk1",
        created_at: 1,
        kind: 1,
        tags: [
          ["e", "child", "", "reply"],
          ["e", ROOT, "", "root"],
        ],
      };
      const directReply: RelatedEvent = {
        id: "direct",
        pubkey: "pk2",
        created_at: 1,
        kind: 1,
        tags: [
          ["e", ROOT, "", "reply"],
          ["e", ROOT, "", "root"],
        ],
      };
      const like: RelatedEvent = {
        id: "l1",
        pubkey: "pk3",
        created_at: 1,
        kind: 7,
        tags: [["e", ROOT]],
      };
      const zap: RelatedEvent = {
        id: "z1",
        pubkey: "pk4",
        created_at: 1,
        kind: 9735,
        tags: [["e", ROOT]],
      };
      const zapOther: RelatedEvent = {
        id: "z2",
        pubkey: "pk5",
        created_at: 1,
        kind: 9735,
        tags: [["e", "child"]],
      };

      const out = filterRelatedEventsToRootNoteEngagementOnly(
        [nestedReply, directReply, like, zap, zapOther],
        ROOT
      );
      expect(out.map((e) => e.id).sort()).toEqual(
        ["direct", "l1", "z1"].sort()
      );
    });
  });
});
