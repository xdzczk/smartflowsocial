import { describe, expect, it } from "vitest";

import {
  getPollSubmitActionForMode,
  getPrimaryCtaLabelForMode,
} from "~/features/posts/composer/components/composer/publish-mode";

describe("composer publish mode helpers", () => {
  it("returns queue CTA for queue mode", () => {
    expect(getPrimaryCtaLabelForMode("queue", "post")).toBe("Add to queue");
    expect(getPrimaryCtaLabelForMode("queue", "thread")).toBe(
      "Add thread to queue"
    );
  });

  it("returns article-specific CTA for article now mode", () => {
    expect(getPrimaryCtaLabelForMode("now", "article")).toBe("Publish article");
    expect(getPrimaryCtaLabelForMode("schedule", "article")).toBe(
      "Schedule article"
    );
    expect(getPrimaryCtaLabelForMode("queue", "article")).toBe(
      "Add article to queue"
    );
  });

  it("maps poll modes to submit actions", () => {
    expect(getPollSubmitActionForMode("now")).toBe("post-poll");
    expect(getPollSubmitActionForMode("queue")).toBe("schedule-poll");
  });
});
