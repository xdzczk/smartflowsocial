import { describe, expect, it } from "vitest";

import {
  appendDraftListSearchExtras,
  buildShortDraftSearchHaystack,
  matchesDraftSearch,
} from "~/features/posts/drafts/utils/draft-search-haystack";
import { buildDraftsContentTypeFilterItems } from "~/features/posts/drafts/utils/drafts-toolbar-segments";
import {
  extractTagsFromEvents,
  getCreatedAtTimestamp,
  getEventsContent,
  getEventsKind,
  getEventsTags,
  parseContentForRegularPost,
} from "~/features/posts/utils/bulk-prepared-event-display.utils";

describe("posts utility coverage", () => {
  describe("bulk-prepared-event-display", () => {
    it("reads event kind/content/tags safely", () => {
      const data = { kind: 1, content: "hello", tags: [["t", "nostr"]] };
      expect(getEventsKind(data)).toBe(1);
      expect(getEventsContent(data)).toBe("hello");
      expect(getEventsTags(data)).toEqual([["t", "nostr"]]);
      expect(getEventsKind(null)).toBeUndefined();
      expect(getEventsContent({ content: 123 })).toBeUndefined();
    });

    it("parses regular post content with url and fallback handling", () => {
      expect(
        parseContentForRegularPost(
          "caption text https://img.example/x.png",
          "fallback",
          "https://fallback"
        )
      ).toEqual({
        caption: "caption text",
        mediaUrl: "https://img.example/x.png",
      });
      expect(
        parseContentForRegularPost("null", "fallback", "https://fallback")
      ).toEqual({
        caption: "fallback",
        mediaUrl: "https://fallback",
      });
    });

    it("extracts hashtag-style tags and created_at", () => {
      expect(
        extractTagsFromEvents([
          ["t", "nostr"],
          ["x", 1],
        ])
      ).toBe("#nostr");
      expect(extractTagsFromEvents("bad")).toBe("");
      expect(getCreatedAtTimestamp({ created_at: 123 })).toBe(123);
      expect(getCreatedAtTimestamp({ created_at: "123" })).toBe(0);
    });
  });

  describe("draft search helpers", () => {
    it("builds lowercase haystack and matches trimmed terms", () => {
      const haystack = buildShortDraftSearchHaystack({
        caption: "HELLO",
        content: "World",
        draftMeta: { key: "Value" },
      });
      expect(haystack).toContain("hello");
      expect(haystack).toContain("world");
      expect(matchesDraftSearch(haystack, "  key  ")).toBe(true);
      expect(matchesDraftSearch(haystack, "")).toBe(true);
      expect(matchesDraftSearch(haystack, "absent")).toBe(false);
    });

    it("ignores unserializable draftMeta and appends extras", () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;
      const haystack = buildShortDraftSearchHaystack({ draftMeta: circular });
      expect(haystack).toBe("  ");

      expect(appendDraftListSearchExtras("base", "QUEUE", "Article")).toBe(
        "base queue article"
      );
      expect(appendDraftListSearchExtras("base", null, "Thread")).toBe(
        "base  thread"
      );
    });
  });

  describe("drafts toolbar segments", () => {
    it("builds all content type filters with tab urls and counts", () => {
      const items = buildDraftsContentTypeFilterItems({
        basePath: "/dashboard",
        queuePathSegment: "/drafts",
        searchParams: new URLSearchParams("q=abc"),
        totalContentCount: 10,
        totalPostsCount: 4,
        totalPollsCount: 1,
        totalThreadsCount: 2,
        totalRepostsCount: 1,
        totalLongformCount: 1,
        bulkCount: 1,
      });
      expect(items).toHaveLength(7);
      expect(items[0]?.to).toContain("tab=all");
      expect(items[1]?.menuLabel).toContain("(4)");
      expect(items[6]?.id).toBe("bulk");
    });
  });
});
