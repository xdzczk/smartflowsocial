import { describe, expect, it } from "vitest";

import { postToCombinedContent } from "~/features/posts/combined";
import type { PostData } from "~/features/posts/types";
import {
  attachedCombinedByParentId,
  attachedCombinedForThreadRow,
  attachedFollowUpChipLabelFromCombinedContent,
  attachedFollowUpMenuTitle,
  effectiveScheduledOrPublishedAtForAttachedMenuItem,
} from "~/features/posts/utils/attached-follow-up-rows";

describe("attached-follow-up-rows", () => {
  it("attachedCombinedForThreadRow collects follow-ups keyed to root or any thread segment", () => {
    const early = {
      id: "seg-a",
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
      id: "seg-b",
      caption: "second",
      scheduledAtUtc: new Date("2025-06-01T11:00:00Z"),
    };
    const followRoot = {
      ...early,
      id: "fu1",
      caption: "child of root",
      dependencyMode: "attached" as const,
      parentScheduledActionId: "seg-a",
      threadGroupId: null,
    };
    const followSegment = {
      ...early,
      id: "fu2",
      caption: "child of segment b",
      dependencyMode: "attached" as const,
      parentScheduledActionId: "seg-b",
      threadGroupId: null,
    };
    const combined = [late, early, followRoot, followSegment].map((p) =>
      postToCombinedContent(p as never)
    );
    const byParent = attachedCombinedByParentId(combined);
    const rowsEarlyRoot = {
      root: combined.find((c) => c.id === "seg-a")!,
      threadSegments: [combined.find((c) => c.id === "seg-b")!],
    };
    const merged = attachedCombinedForThreadRow(byParent, rowsEarlyRoot);
    expect(merged.map((c) => c.id).sort()).toEqual(["fu1", "fu2"]);
  });

  it("attachedFollowUpMenuTitle reflects post kind", () => {
    expect(attachedFollowUpMenuTitle("REPOST", 1)).toBe("Follow-up repost 1");
    expect(attachedFollowUpMenuTitle("QUOTE", 2)).toBe("Follow-up quote 2");
    expect(attachedFollowUpMenuTitle(undefined, 3)).toBe("Follow-up 3");
  });

  it("attachedFollowUpChipLabelFromCombinedContent returns kind chip for attached posts", () => {
    const fu = postToCombinedContent({
      id: "fu",
      userId: "u",
      caption: "c",
      content: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      dependencyMode: "attached",
      parentScheduledActionId: "p",
      postKind: "REPOST",
      fileUrl: [],
      postType: "TEXT",
      tags: [],
      manual_override: false,
      repost: false,
      isQuotedPost: false,
      isRecyclable: false,
      hashTagPresetId: null,
      nostrEventId: null,
      scheduledAtUtc: new Date(),
      publishedAt: null,
      signedEvent: null,
      nostrEvent: null,
    } as unknown as PostData);
    expect(attachedFollowUpChipLabelFromCombinedContent(fu)).toBe(
      "Follow-up repost"
    );
  });

  it("effectiveScheduledOrPublishedAtForAttachedMenuItem prefers originalData times", () => {
    const parentWrong = new Date("2025-06-01T10:00:00Z");
    const childCorrect = new Date("2025-06-01T18:00:00Z");
    const raw: PostData = {
      id: "child",
      userId: "u",
      caption: "x",
      content: null,
      scheduledAtUtc: childCorrect,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      dependencyMode: "attached",
      parentScheduledActionId: "root",
      postKind: "REPOST",
      fileUrl: [],
      postType: "TEXT",
      tags: [],
      manual_override: false,
      repost: false,
      isQuotedPost: false,
      isRecyclable: false,
      hashTagPresetId: null,
      nostrEventId: null,
      publishedAt: null,
      signedEvent: null,
      nostrEvent: null,
    } as unknown as PostData;
    const item = postToCombinedContent(raw);
    /** Simulate a stale top-level hydrate mirroring the parent row */
    item.scheduledAtUtc = parentWrong;

    expect(
      effectiveScheduledOrPublishedAtForAttachedMenuItem(item, "scheduled")
    ).toEqual(childCorrect);
  });

  it("effectiveScheduledOrPublishedAtForAttachedMenuItem prefers nominal over scheduled on originalData", () => {
    const nominal = new Date("2025-06-02T12:00:00Z");
    const scheduled = new Date("2025-06-02T15:00:00Z");
    const raw: PostData = {
      id: "child",
      userId: "u",
      caption: "x",
      content: null,
      scheduledAtUtc: scheduled,
      nominalScheduledAtUtc: nominal,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      dependencyMode: "attached",
      parentScheduledActionId: "root",
      postKind: "REPOST",
      fileUrl: [],
      postType: "TEXT",
      tags: [],
      manual_override: false,
      repost: false,
      isQuotedPost: false,
      isRecyclable: false,
      hashTagPresetId: null,
      nostrEventId: null,
      publishedAt: null,
      signedEvent: null,
      nostrEvent: null,
    } as unknown as PostData;
    const item = postToCombinedContent(raw);
    expect(
      effectiveScheduledOrPublishedAtForAttachedMenuItem(item, "scheduled")
    ).toEqual(nominal);
  });

  it("effectiveScheduledOrPublishedAtForAttachedMenuItem parses ISO schedule strings on originalData", () => {
    const raw: PostData = {
      id: "child",
      userId: "u",
      caption: "x",
      content: null,
      scheduledAtUtc: "2025-07-01T08:30:00.000Z" as unknown as Date,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      dependencyMode: "attached",
      parentScheduledActionId: "root",
      fileUrl: [],
      postType: "TEXT",
      tags: [],
      manual_override: false,
      repost: false,
      isQuotedPost: false,
      isRecyclable: false,
      hashTagPresetId: null,
      nostrEventId: null,
      publishedAt: null,
      signedEvent: null,
      nostrEvent: null,
    } as unknown as PostData;
    const item = postToCombinedContent(raw);
    expect(
      effectiveScheduledOrPublishedAtForAttachedMenuItem(
        item,
        "scheduled"
      )?.toISOString()
    ).toBe("2025-07-01T08:30:00.000Z");
  });
});
