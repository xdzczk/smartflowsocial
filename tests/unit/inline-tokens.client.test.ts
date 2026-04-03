import { describe, expect, it } from "vitest";

import {
  appendMediaUrlsForSigning,
  stripAttachmentTokens,
} from "~/features/posts/utils/inline-tokens.client";

describe("inline-tokens.client", () => {
  it("stripAttachmentTokens removes tokens and trims trailing blank runs", () => {
    const raw = "Hello\n\n[attach:a]\n[attach:b]\n\nWorld";
    expect(stripAttachmentTokens(raw)).toBe("Hello\n\nWorld");
  });

  it("appendMediaUrlsForSigning appends URLs after body with blank line", () => {
    expect(appendMediaUrlsForSigning("Hello", ["https://x.test/a.jpg"])).toBe(
      "Hello\n\nhttps://x.test/a.jpg"
    );
  });

  it("appendMediaUrlsForSigning returns only URLs when body empty", () => {
    expect(
      appendMediaUrlsForSigning("", ["https://a.test/1", "https://b.test/2"])
    ).toBe("https://a.test/1\nhttps://b.test/2");
  });

  it("appendMediaUrlsForSigning leaves content unchanged when no urls", () => {
    expect(appendMediaUrlsForSigning("Hi", [])).toBe("Hi");
  });
});
