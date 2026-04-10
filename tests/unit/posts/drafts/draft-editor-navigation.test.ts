import { describe, expect, it } from "vitest";

import {
  getBulkGroupUrl,
  getLongFormDraftEditUrl,
  getShortDraftComposeType,
  getShortDraftComposeUrl,
  getShortDraftEditRedirectPath,
} from "~/features/posts/drafts/utils/draft-editor-navigation";
import type { DraftPostLike } from "~/features/posts/drafts/utils/draft-post-classification";

describe("draft-editor-navigation", () => {
  it("maps compose type from draft classification", () => {
    const pollPost: DraftPostLike = { postType: "POLL" };
    expect(getShortDraftComposeType(pollPost)).toBe("poll");

    const threadPost: DraftPostLike = {
      postType: "TEXT",
      draftMeta: { threadSegments: [{ content: "a" }, { content: "b" }] },
    };
    expect(getShortDraftComposeType(threadPost)).toBe("thread");

    const textPost: DraftPostLike = { postType: "TEXT" };
    expect(getShortDraftComposeType(textPost)).toBe("post");
  });

  it("builds compose URL with encoded params", () => {
    const post: DraftPostLike = { postType: "POLL" };
    const url = getShortDraftComposeUrl("id/with space", post);
    expect(url).toContain("type=poll");
    expect(url).toContain("id=id%2Fwith%20space");
  });

  it("builds longform edit and bulk URLs", () => {
    expect(getLongFormDraftEditUrl("lf-1")).toBe(
      "/dashboard/drafts/longform/edit/lf-1"
    );
    expect(getBulkGroupUrl("g&1")).toBe("/dashboard/bulkposts?groupId=g%261");
    expect(getShortDraftEditRedirectPath("p1")).toBe(
      "/dashboard/drafts/edit/p1"
    );
  });
});
