import { describe, expect, it } from "vitest";

import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";

describe("isPureRepostSourcePost", () => {
  it("returns true for REPOST kind without quote", () => {
    expect(
      isPureRepostSourcePost({
        postKind: "REPOST",
        repost: true,
        isQuotedPost: false,
      })
    ).toBe(true);
  });

  it("returns false for quotes", () => {
    expect(
      isPureRepostSourcePost({
        postKind: "QUOTE",
        repost: false,
        isQuotedPost: true,
      })
    ).toBe(false);
  });

  it("returns true when legacy repost flag without quote", () => {
    expect(
      isPureRepostSourcePost({
        postKind: "POST",
        repost: true,
        isQuotedPost: false,
      })
    ).toBe(true);
  });

  it("returns false for normal posts", () => {
    expect(
      isPureRepostSourcePost({
        postKind: "POST",
        repost: false,
        isQuotedPost: false,
      })
    ).toBe(false);
  });
});
