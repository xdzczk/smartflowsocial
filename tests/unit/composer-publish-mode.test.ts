import { describe, expect, it } from "vitest";

import {
  getPollSubmitActionForMode,
  getPrimaryCtaLabelForMode,
} from "~/features/posts/composer/components/composer/publish-mode";

describe("composer publish mode helpers", () => {
  it("returns queue CTA for queue mode", () => {
    expect(getPrimaryCtaLabelForMode("queue", "post")).toBe("Add to queue");
    expect(getPrimaryCtaLabelForMode("queue", "thread")).toBe("Add to queue");
  });

  it("uses unified CTA labels across entity types", () => {
    expect(getPrimaryCtaLabelForMode("now", "article")).toBe("Publish now");
    expect(getPrimaryCtaLabelForMode("schedule", "article")).toBe(
      "Schedule post"
    );
    expect(getPrimaryCtaLabelForMode("queue", "article")).toBe("Add to queue");
  });

  it("maps poll modes to submit actions", () => {
    expect(getPollSubmitActionForMode("now")).toBe("post-poll");
    expect(getPollSubmitActionForMode("queue")).toBe("schedule-poll");
  });
});
