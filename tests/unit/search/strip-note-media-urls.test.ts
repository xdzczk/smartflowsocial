import { describe, expect, it } from "vitest";

import { stripRenderedMediaUrlsFromNoteText } from "~/features/search/utils/strip-note-media-urls";

describe("stripRenderedMediaUrlsFromNoteText", () => {
  it("removes a URL that is also listed as media", () => {
    const url = "https://example.com/pic.jpg";
    const content = `Hello\n${url}\nmore`;
    expect(stripRenderedMediaUrlsFromNoteText(content, [url])).toBe(
      "Hello\n\nmore"
    );
  });

  it("returns empty string with media-only fallback signal when nothing left", () => {
    const url = "https://example.com/x.png";
    expect(stripRenderedMediaUrlsFromNoteText(url, [url])).toBe("");
  });

  it("leaves content unchanged when media list empty", () => {
    expect(stripRenderedMediaUrlsFromNoteText("hello", [])).toBe("hello");
  });
});
