import { describe, expect, it } from "vitest";

import {
  publishedEventId,
  publishedNoteExcerpt,
} from "~/features/analytics/published-events";

const EVENT_ID = "ab".repeat(32);

describe("published event indexing", () => {
  it("reads a stored id and falls back to the signed event", () => {
    expect(publishedEventId(EVENT_ID, null)).toBe(EVENT_ID);
    expect(publishedEventId(null, { id: EVENT_ID })).toBe(EVENT_ID);
    expect(publishedEventId("not-an-id", { id: "also-no" })).toBeNull();
  });

  it("uses the first text that is present", () => {
    expect(publishedNoteExcerpt([null, "  ", "a meme"])).toBe("a meme");
    expect(publishedNoteExcerpt([null, null])).toBe("");
  });
});
