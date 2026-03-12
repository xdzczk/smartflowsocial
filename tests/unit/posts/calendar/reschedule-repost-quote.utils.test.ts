/**
 * Unit tests for reschedule-repost-quote.utils (Phase 3.1): canScheduleRepostQuoteForPost.
 * Uses partial CalendarPost mocks; eslint consistent-type-assertions relaxed for test fixtures.
 */

import { describe, expect, it } from "vitest";

import type { CalendarPost } from "~/features/posts/calendar/Calendar/PostBlock.types";
import { canScheduleRepostQuoteForPost } from "~/features/posts/calendar/Calendar/utils/reschedule-repost-quote.utils";

describe("reschedule-repost-quote.utils", () => {
  describe("canScheduleRepostQuoteForPost", () => {
    it("returns false when isLongform is true", () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- partial CalendarPost for test */
      const post: CalendarPost = {
        signedEvent: { id: "e1", pubkey: "pk" },
      } as CalendarPost;
      expect(canScheduleRepostQuoteForPost(true, post)).toBe(false);
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
    });

    it("returns false when post has no signedEvent", () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- partial CalendarPost for test */
      const post: CalendarPost = { signedEvent: null } as CalendarPost;
      const emptyPost: CalendarPost = {} as CalendarPost;
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      expect(canScheduleRepostQuoteForPost(false, post)).toBe(false);
      expect(canScheduleRepostQuoteForPost(false, emptyPost)).toBe(false);
    });

    it("returns false when signedEvent is not an object", () => {
      const post: CalendarPost = {
        signedEvent: "string",
      } as unknown as CalendarPost;

      expect(canScheduleRepostQuoteForPost(false, post)).toBe(false);
    });

    it("returns false when signedEvent lacks id or pubkey", () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- partial CalendarPost for test */
      const postIdOnly: CalendarPost = {
        signedEvent: { id: "e1" },
      } as CalendarPost;
      const postPubkeyOnly: CalendarPost = {
        signedEvent: { pubkey: "pk" },
      } as CalendarPost;
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      expect(canScheduleRepostQuoteForPost(false, postIdOnly)).toBe(false);
      expect(canScheduleRepostQuoteForPost(false, postPubkeyOnly)).toBe(false);
    });

    it("returns true when not longform and signedEvent has id and pubkey", () => {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- partial CalendarPost for test */
      const post: CalendarPost = {
        signedEvent: { id: "e1", pubkey: "pk1" },
      } as CalendarPost;
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      expect(canScheduleRepostQuoteForPost(false, post)).toBe(true);
    });
  });
});
