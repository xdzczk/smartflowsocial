import { describe, it, expect } from "vitest";

import { postToCombinedContent } from "~/features/posts/combined";
import {
  buildPostThreadRows,
  buildThreadListRows,
  filterPostsBySearchWithThreads,
} from "~/features/posts/utils/thread-list-grouping";

describe("thread-list-grouping", () => {
  it("buildThreadListRows keeps earliest segment as root", () => {
    const early = {
      id: "a",
      threadGroupId: "g1",
      caption: "first",
      scheduledAtUtc: new Date("2025-06-01T10:00:00Z"),
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      fileUrl: [],
    };
    const late = {
      ...early,
      id: "b",
      caption: "second",
      scheduledAtUtc: new Date("2025-06-01T11:00:00Z"),
    };
    const combined = [late, early].map((p) =>
      postToCombinedContent(p as never)
    );
    const rows = buildThreadListRows(combined, "scheduled");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.root.id).toBe("a");
    expect(rows[0]?.threadSegments).toHaveLength(1);
    expect(rows[0]?.threadSegments[0]?.id).toBe("b");
  });

  it("filterPostsBySearchWithThreads includes full thread when any segment matches", () => {
    const g = "tg";
    const posts = [
      {
        id: "1",
        threadGroupId: g,
        caption: "alpha root",
        scheduledAtUtc: new Date(),
        userId: "u",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SCHEDULED",
        currentState: "SCHEDULED",
        fileUrl: [],
      },
      {
        id: "2",
        threadGroupId: g,
        caption: "beta child matches",
        scheduledAtUtc: new Date(),
        userId: "u",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SCHEDULED",
        currentState: "SCHEDULED",
        fileUrl: [],
      },
    ] as never[];
    const out = filterPostsBySearchWithThreads(posts as never, "beta");
    expect(out.map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  it("buildPostThreadRows matches combined grouping", () => {
    const posts = [
      {
        id: "x",
        threadGroupId: "g",
        caption: "x",
        scheduledAtUtc: new Date("2025-01-02T00:00:00Z"),
        userId: "u",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SCHEDULED",
        currentState: "SCHEDULED",
        fileUrl: [],
      },
      {
        id: "y",
        threadGroupId: "g",
        caption: "y",
        scheduledAtUtc: new Date("2025-01-01T00:00:00Z"),
        userId: "u",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SCHEDULED",
        currentState: "SCHEDULED",
        fileUrl: [],
      },
    ] as never[];
    const rows = buildPostThreadRows(posts as never, "scheduled");
    expect(rows[0]?.root.id).toBe("y");
    expect(rows[0]?.threadSegments).toHaveLength(1);
    expect(rows[0]?.threadSegments[0]?.id).toBe("x");
  });
});
