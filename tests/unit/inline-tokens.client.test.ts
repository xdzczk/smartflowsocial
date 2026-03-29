import { describe, expect, it } from "vitest";

import {
  contentHasAttachmentTokens,
  reorderAttachmentTokensInContent,
  stripAttachmentTokens,
} from "~/features/posts/utils/inline-tokens.client";

describe("inline-tokens.client", () => {
  it("stripAttachmentTokens removes tokens and trims trailing blank runs", () => {
    const raw = "Hello\n\n[attach:a]\n[attach:b]\n\nWorld";
    expect(stripAttachmentTokens(raw)).toBe("Hello\n\nWorld");
  });

  it("reorderAttachmentTokensInContent moves token block to match attachment order", () => {
    const content = "Intro\n\n[attach:old1]\n\n[attach:old2]";
    const next = reorderAttachmentTokensInContent(content, ["old2", "old1"]);
    expect(next).toBe("Intro\n\n[attach:old2]\n\n[attach:old1]");
  });

  it("reorderAttachmentTokensInContent returns only tokens when body empty", () => {
    expect(reorderAttachmentTokensInContent("[attach:x]", ["x"])).toBe(
      "[attach:x]"
    );
  });

  it("contentHasAttachmentTokens detects placeholders", () => {
    expect(contentHasAttachmentTokens("hi [attach:x]")).toBe(true);
    expect(contentHasAttachmentTokens("no tokens")).toBe(false);
  });
});
