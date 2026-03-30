import { describe, expect, it } from "vitest";

import {
  buildDraftRowPreview,
  draftTypeLabel,
} from "~/features/posts/drafts/utils/draft-row-preview";

describe("draft-row-preview", () => {
  it("summarizes poll drafts from draftMeta", () => {
    const pollPost: Parameters<typeof buildDraftRowPreview>[0] = {
      id: "1",
      postType: "POLL",
      draftMeta: {
        pollQuestion: "Favorite color?",
        pollOptionLabels: ["Red", "Blue"],
      },
    };
    const p = buildDraftRowPreview(pollPost);
    expect(p.title).toContain("Favorite color");
    expect(p.subtitle).toMatch(/2 options/);

    const pollLabelPost: Parameters<typeof draftTypeLabel>[0] = {
      postType: "POLL",
    };
    expect(draftTypeLabel(pollLabelPost)).toBe("Poll");
  });

  it("summarizes thread drafts", () => {
    const threadPost: Parameters<typeof buildDraftRowPreview>[0] = {
      id: "2",
      postType: "TEXT",
      draftMeta: {
        threadTitle: "My thread",
        threadSegments: [{ content: "First line" }],
      },
    };
    const p = buildDraftRowPreview(threadPost);
    expect(p.title).toBe("My thread");
    expect(p.subtitle).toMatch(/starts with/);

    const threadLabelPost: Parameters<typeof draftTypeLabel>[0] = {
      postType: "TEXT",
      draftMeta: { threadSegments: [{}] },
    };
    expect(draftTypeLabel(threadLabelPost)).toBe("Thread");
  });
});
