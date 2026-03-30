import { describe, expect, it } from "vitest";

import { KIND_POLL } from "~/features/polls";
import { buildInitialPollRestoreFromDraftPost } from "~/features/posts/composer/services/build-initial-poll-restore.server";

describe("buildInitialPollRestoreFromDraftPost", () => {
  it("returns null for non-poll posts", () => {
    expect(
      buildInitialPollRestoreFromDraftPost({
        postType: "TEXT",
        content: "hi",
      })
    ).toBeNull();
  });

  it("restores from signed kind 1068 when present", () => {
    const r = buildInitialPollRestoreFromDraftPost({
      postType: "POLL",
      signedEvent: {
        id: "e1",
        pubkey: "pk",
        kind: KIND_POLL,
        content: "Q?",
        tags: [
          ["option", "a", "One"],
          ["option", "b", "Two"],
          ["relay", "wss://r.example"],
        ],
        created_at: 100,
      },
      tags: ["foo"],
      hashTagPresetId: null,
      queueType: { name: "Q1" },
    });
    expect(r).not.toBeNull();
    expect(r?.question).toBe("Q?");
    expect(r?.options).toEqual(["One", "Two"]);
    expect(r?.queueType).toBe("Q1");
  });

  it("falls back to content and draftMeta labels", () => {
    const r = buildInitialPollRestoreFromDraftPost({
      postType: "POLL",
      content: "Plain question",
      draftMeta: {
        pollOptionLabels: ["A", "B"],
        pollType: "multiplechoice",
      },
      queueType: { name: "unassigned" },
    });
    expect(r?.question).toBe("Plain question");
    expect(r?.options).toEqual(["A", "B"]);
    expect(r?.pollType).toBe("multiplechoice");
  });
});
