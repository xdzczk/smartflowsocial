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
  it("displayParentContextSublabel returns Unknown source note for bare mentions root", () => {
    const p = parent({ contextLabel: undefined });
    expect(displayParentContextSublabel(p, "mentions")).toBe(
      "Unknown source note"
    );
    expect(displayParentContextSublabel(p, "replies")).toBeNull();
  });

  it("displayParentContextSublabel adds Referenced your note for referenced-note context in mentions", () => {
    const p = parent({ contextLabel: "Referenced note (Nostr)" });
    expect(displayParentContextLabel(p, "mentions")).toBe("Mention in thread");
    expect(displayParentContextSublabel(p, "mentions")).toBe(
      "Referenced your note"
    );
  });
});
