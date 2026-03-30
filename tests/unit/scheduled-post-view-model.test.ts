import { describe, expect, it } from "vitest";

import {
  inferScheduledCapabilitiesFromModalPost,
  scheduledPostViewModelFromPostData,
} from "~/features/posts/scheduled";
import type { PostData } from "~/features/posts/types";

describe("scheduled-post-view-model", () => {
  it("marks pure repost as non-editable content", () => {
    const post = {
      id: "1",
      postKind: "REPOST",
      repost: true,
      isQuotedPost: false,
    } as unknown as PostData;
    const vm = scheduledPostViewModelFromPostData(post);
    expect(vm.capabilities.canEditContent).toBe(false);
  });

  it("allows edit for quote-like posts", () => {
    const post = {
      id: "1",
      postKind: "QUOTE",
      repost: false,
      isQuotedPost: true,
    } as unknown as PostData;
    const vm = scheduledPostViewModelFromPostData(post);
    expect(vm.capabilities.canEditContent).toBe(true);
  });

  it("inferScheduledCapabilitiesFromModalPost uses fileUrl shape for posts", () => {
    const post = {
      id: "x",
      fileUrl: [],
      caption: "hi",
      postKind: "POST",
    } as unknown as PostData;
    const caps = inferScheduledCapabilitiesFromModalPost(post);
    expect(caps.canEditContent).toBe(true);
  });
});
