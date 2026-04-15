import { describe, expect, it } from "vitest";

import { didDeleteActionSucceed } from "~/features/posts/components/post-detail-modal/post-detail-helpers";

describe("didDeleteActionSucceed", () => {
  it("returns explicit success when success=true", () => {
    expect(didDeleteActionSucceed({ success: true, error: "ignored" })).toBe(
      true
    );
  });

  it("returns explicit failure when success=false", () => {
    expect(didDeleteActionSucceed({ success: false })).toBe(false);
  });

  it("treats payload without success and without error as success", () => {
    expect(didDeleteActionSucceed({})).toBe(true);
  });

  it("treats payload without success but with error as failure", () => {
    expect(didDeleteActionSucceed({ error: "something failed" })).toBe(false);
  });
});
