import { describe, expect, it } from "vitest";

import { prepareComposerTextAndFileUrls } from "~/features/posts/composer/services/newpost-action/inline-tokens.server";

describe("inline-tokens.server prepareComposerTextAndFileUrls", () => {
  it("strips legacy tokens and builds fileUrl in attachmentMeta order", () => {
    const { content, fileUrl } = prepareComposerTextAndFileUrls(
      "Hi\n\n[attach:old]\n",
      [
        { localId: "a", url: "https://a.test/1.jpg" },
        { localId: "b", url: "https://b.test/2.jpg" },
      ]
    );
    expect(content).toBe("Hi");
    expect(fileUrl).toEqual(["https://a.test/1.jpg", "https://b.test/2.jpg"]);
  });

  it("omits entries without url", () => {
    const { fileUrl } = prepareComposerTextAndFileUrls("x", [
      { localId: "a", url: "https://u.test/a" },
      { localId: "b" },
    ]);
    expect(fileUrl).toEqual(["https://u.test/a"]);
  });
});
