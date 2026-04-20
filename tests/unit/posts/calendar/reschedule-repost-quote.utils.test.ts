/**
 * Unit tests for reschedule-repost-quote.utils (Phase 3.1): canScheduleRepostQuoteForPost.
 * Uses partial CalendarPost mocks; eslint consistent-type-assertions relaxed for test fixtures.
 */

import { describe, expect, it, vi } from "vitest";

import type { CalendarPost } from "~/features/posts/calendar/Calendar/PostBlock.types";
import {
  canScheduleRepostQuoteForPost,
  submitQuoteSchedule,
  submitRepostSchedule,
} from "~/features/posts/calendar/Calendar/utils/reschedule-repost-quote.utils";

const mocks = vi.hoisted(() => ({
  buildKind6RepostEvent: vi.fn(),
  buildQuoteEvent: vi.fn(),
  signEvent: vi.fn(),
}));

vi.mock("~/features/posts/utils/repost-quote-events.client", () => ({
  buildKind6RepostEvent: (...args: unknown[]) =>
    mocks.buildKind6RepostEvent(...args),
  buildQuoteEvent: (...args: unknown[]) => mocks.buildQuoteEvent(...args),
}));

vi.mock("~/lib/nostr-adapter.client", () => ({
  nostrAdapter: {
    signEvent: (...args: unknown[]) => mocks.signEvent(...args),
  },
}));

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

  describe("submitRepostSchedule", () => {
    it("signs repost event and submits all condition fields", async () => {
      mocks.buildKind6RepostEvent.mockReturnValue({
        content: "repost",
        created_at: 123,
        kind: 6,
        tags: [["e", "abc"]],
      });
      mocks.signEvent.mockResolvedValue({
        signedEvent: { id: "signed-1", kind: 6 },
      });
      const submit = vi.fn();

      await submitRepostSchedule(
        "post-1",
        {
          id: "orig",
          pubkey: "pk",
          created_at: 111,
          kind: 1,
          tags: [],
          content: "x",
          sig: "sig",
        },
        999,
        submit,
        {
          minReactions: 1,
          minZaps: 2,
          minComments: 3,
          minReposts: 4,
          minSats: 5,
        }
      );

      expect(mocks.signEvent).toHaveBeenCalled();
      const formData = submit.mock.calls[0]?.[0] as FormData;
      expect(formData.get("_action")).toBe("scheduleRepost");
      expect(formData.get("postId")).toBe("post-1");
      expect(formData.get("scheduledFor")).toBe("999");
      expect(formData.get("minSats")).toBe("5");
    });
  });

  describe("submitQuoteSchedule", () => {
    it("signs quote event and includes caption when provided", async () => {
      mocks.buildQuoteEvent.mockReturnValue({
        content: "quote",
        created_at: 123,
        kind: 1,
        tags: [["e", "abc"]],
      });
      mocks.signEvent.mockResolvedValue({
        signedEvent: { id: "signed-2", kind: 1 },
      });
      const submit = vi.fn();

      await submitQuoteSchedule(
        "post-2",
        {
          id: "orig",
          pubkey: "pk",
          created_at: 111,
          kind: 1,
          tags: [],
          content: "x",
          sig: "sig",
        },
        1000,
        "caption",
        submit
      );

      const formData = submit.mock.calls[0]?.[0] as FormData;
      expect(formData.get("_action")).toBe("scheduleQuote");
      expect(formData.get("postId")).toBe("post-2");
      expect(formData.get("quoteCaption")).toBe("caption");
    });
  });
});
