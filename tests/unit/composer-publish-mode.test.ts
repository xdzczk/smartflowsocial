import { describe, expect, it } from "vitest";

import {
  getPollSubmitActionForMode,
  getPrimaryCtaLabelForMode,
} from "~/features/posts/composer/components/composer/publish-mode";

describe("composer publish mode helpers", () => {
  it("returns save draft CTA for draft mode", () => {
    expect(getPrimaryCtaLabelForMode("draft", "post")).toBe("Save draft");
    expect(getPrimaryCtaLabelForMode("draft", "poll")).toBe("Save draft");
    expect(getPrimaryCtaLabelForMode("draft", "thread")).toBe("Save draft");
    expect(getPrimaryCtaLabelForMode("draft", "article")).toBe("Save draft");
  });

  it("returns article-specific CTA for article now mode", () => {
    expect(getPrimaryCtaLabelForMode("now", "article")).toBe(
      "Publish article now"
    );
  });

  it("does not map poll draft mode to server submit action", () => {
    expect(getPollSubmitActionForMode("draft")).toBeNull();
  });
});
