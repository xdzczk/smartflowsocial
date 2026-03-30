import { describe, expect, it } from "vitest";

import { getScheduledPostCapabilities } from "~/features/posts/scheduled";

describe("getScheduledPostCapabilities", () => {
  it("longform always allows content edit", () => {
    const c = getScheduledPostCapabilities({ entityKind: "longform" });
    expect(c.canEditContent).toBe(true);
    expect(c.canReschedule).toBe(true);
  });

  it("pure repost by kind blocks content edit", () => {
    const c = getScheduledPostCapabilities({
      entityKind: "post",
      postKind: "REPOST",
      repost: false,
      isQuotedPost: false,
    });
    expect(c.canEditContent).toBe(false);
  });

  it("quote post allows edit", () => {
    const c = getScheduledPostCapabilities({
      entityKind: "post",
      postKind: "QUOTE",
      repost: false,
      isQuotedPost: true,
    });
    expect(c.canEditContent).toBe(true);
  });
});
