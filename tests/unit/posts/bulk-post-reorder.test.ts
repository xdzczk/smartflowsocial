import { describe, expect, it } from "vitest";

import type { BulkPost } from "~/features/posts/types";
import {
  swapAdjacentBulkPostRowContent,
  swapBulkPostContentPreservingSchedule,
} from "~/features/posts/utils/bulk-post-reorder";

function row(id: string, slot: string, caption: string): BulkPost {
  return {
    clientId: id,
    queueType: "Queue A",
    scheduledFor: slot,
    caption,
    files: [],
    isRecyclable: false,
    includeHashtagsInNoteBody: true,
  };
}

describe("swapBulkPostContentPreservingSchedule", () => {
  it("keeps schedule on each row index identity while swapping captions", () => {
    const a = row("c1", "2026-05-10T09:00", "meme A");
    const b = row("c2", "2026-05-12T09:00", "meme B");
    const [na, nb] = swapBulkPostContentPreservingSchedule(a, b);
    expect(na.clientId).toBe("c1");
    expect(na.scheduledFor).toBe("2026-05-10T09:00");
    expect(na.caption).toBe("meme B");
    expect(nb.clientId).toBe("c2");
    expect(nb.scheduledFor).toBe("2026-05-12T09:00");
    expect(nb.caption).toBe("meme A");
  });
});

describe("swapAdjacentBulkPostRowContent", () => {
  it("returns null for invalid direction", () => {
    const posts = [row("a", "t0", "0"), row("b", "t1", "1")];
    expect(swapAdjacentBulkPostRowContent(posts, 0, "up")).toBeNull();
    expect(swapAdjacentBulkPostRowContent(posts, 1, "down")).toBeNull();
  });

  it("swaps content between neighbors", () => {
    const posts = [
      row("a", "t0", "first"),
      row("b", "t1", "second"),
      row("c", "t2", "third"),
    ];
    const next = swapAdjacentBulkPostRowContent(posts, 1, "up");
    expect(next).not.toBeNull();
    expect(next![0]!.caption).toBe("second");
    expect(next![0]!.scheduledFor).toBe("t0");
    expect(next![1]!.caption).toBe("first");
    expect(next![1]!.scheduledFor).toBe("t1");
    expect(next![2]!.caption).toBe("third");
  });
});
