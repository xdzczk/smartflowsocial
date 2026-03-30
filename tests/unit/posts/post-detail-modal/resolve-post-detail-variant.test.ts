import { describe, expect, it } from "vitest";

import {
  getHeaderTypeLabel,
  resolveInnerContentVariant,
  resolvePostDetailVariant,
} from "~/features/posts/components/post-detail-modal/resolve-post-detail-variant";

describe("resolvePostDetailVariant", () => {
  it("uses thread variant when threadGroupId is set", () => {
    const post = {
      id: "a",
      fileUrl: [],
      threadGroupId: "g1",
      postKind: "POST",
      postType: "TEXT",
    } as const;
    const r = resolvePostDetailVariant({
      nip88PollsEnabled: false,
      post: post as never,
      type: "scheduled",
    });
    expect(r.variant).toBe("thread");
    expect(r.innerVariant).toBe("text");
  });

  it("uses poll inner variant when NIP-88 poll", () => {
    const post = {
      id: "b",
      fileUrl: [],
      postType: "POLL",
      postKind: "POST",
    } as const;
    expect(
      resolveInnerContentVariant({
        nip88PollsEnabled: true,
        post: post as never,
        type: "published",
      })
    ).toBe("poll");
  });

  it("uses media when attachments exist and not thread", () => {
    const post = {
      id: "c",
      fileUrl: ["https://x.test/a.jpg"],
      postKind: "POST",
      postType: "IMAGE",
    } as const;
    const r = resolvePostDetailVariant({
      nip88PollsEnabled: false,
      post: post as never,
      type: "published",
    });
    expect(r.variant).toBe("media");
    expect(r.heightMode).toBe("large");
  });

  it("header label for poll", () => {
    expect(getHeaderTypeLabel({ variant: "poll", innerVariant: "poll" })).toBe(
      "Poll"
    );
  });
});
