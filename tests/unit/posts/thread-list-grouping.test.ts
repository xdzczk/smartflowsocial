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

  it("buildThreadListRows omits attached follow-ups as their own row", () => {
    const parent = {
      id: "parent-1",
      caption: "root",
      scheduledAtUtc: new Date("2025-06-01T10:00:00Z"),
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      fileUrl: [],
    };
    const followUp = {
      ...parent,
      id: "child-1",
      caption: "follow-up",
      dependencyMode: "attached" as const,
      parentScheduledActionId: "parent-1",
      threadGroupId: null,
    };
    const combined = [parent, followUp].map((p) =>
      postToCombinedContent(p as never)
    );
    const rows = buildThreadListRows(combined, "scheduled");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.root.id).toBe("parent-1");
    expect(rows[0]?.threadSegments).toHaveLength(0);
  });

  it("buildThreadListRows shows orphan attached follow-ups as standalone rows (parent not in list)", () => {
    const tg = "thread-a";
    /** Parent published — not present in scheduled listing */
    const sibling = {
      id: "seg-2",
      threadGroupId: tg,
      caption: "segment",
      scheduledAtUtc: new Date("2025-06-01T10:00:00Z"),
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      fileUrl: [],
    };
    const orphanFollowUp = {
      ...sibling,
      id: "follow-up-1",
      caption: "follow-up",
      scheduledAtUtc: new Date("2025-06-01T12:00:00Z"),
      dependencyMode: "attached" as const,
      parentScheduledActionId: "parent-published",
    };
    const combined = [sibling, orphanFollowUp].map((p) =>
      postToCombinedContent(p as never)
    );
    const rows = buildThreadListRows(combined, "scheduled");
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.root.id).sort();
    expect(ids).toEqual(["follow-up-1", "seg-2"]);
    const fu = rows.find((r) => r.root.id === "follow-up-1");
    expect(fu?.threadSegments).toHaveLength(0);
    const segRow = rows.find((r) => r.root.id === "seg-2");
    expect(segRow?.threadSegments).toHaveLength(0);
  });

  it("filterPostsBySearchWithThreads keeps parent when only attached follow-up caption matches", () => {
    const parent = {
      id: "p1",
      caption: "alpha",
      scheduledAtUtc: new Date(),
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      fileUrl: [],
    };
    const attached = {
      ...parent,
      id: "c1",
      caption: "beta unique",
      dependencyMode: "attached" as const,
      parentScheduledActionId: "p1",
    };
    const out = filterPostsBySearchWithThreads(
      [parent, attached] as never,
      "unique"
    );
    expect(out.map((p) => p.id).sort()).toEqual(["c1", "p1"]);
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
