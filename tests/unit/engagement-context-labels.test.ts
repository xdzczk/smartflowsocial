import { describe, expect, it } from "vitest";

import type { ParentPost } from "~/features/engagement/types";
import {
  displayParentContextLabel,
  displayParentContextSublabel,
} from "~/features/engagement/utils/engagement-context-labels";

function parent(partial: Partial<ParentPost>): ParentPost {
  return {
    id: "post-1",
    eventId: "e1",
    pubkey: "p1",
    publishedAt: null,
    isLongform: false,
    ...partial,
  };
}

describe("engagement-context-labels", () => {
  it("displayParentContextSublabel returns Unknown source note when source body is missing", () => {
    const p = parent({ contextLabel: undefined, caption: null });
    expect(displayParentContextSublabel(p, "mentions")).toBe(
      "Unknown source note"
    );
    expect(displayParentContextSublabel(p, "replies")).toBeNull();
  });

  it("displayParentContextSublabel omits Unknown when Your post has caption or media", () => {
    expect(
      displayParentContextSublabel(
        parent({ contextLabel: undefined, caption: "hello" }),
        "mentions"
      )
    ).toBeNull();
    expect(
      displayParentContextSublabel(
        parent({ contextLabel: undefined, caption: null, fileUrl: "/x.png" }),
        "mentions"
      )
    ).toBeNull();
  });

  it("displayParentContextSublabel adds Referenced your note for referenced-note context in mentions", () => {
    const p = parent({ contextLabel: "Referenced note (Nostr)" });
    expect(displayParentContextLabel(p, "mentions")).toBe("Mention in thread");
    expect(displayParentContextSublabel(p, "mentions")).toBe(
      "Referenced your note"
    );
  });
});
