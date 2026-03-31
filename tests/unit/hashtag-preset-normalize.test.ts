import { describe, expect, it } from "vitest";

import { normalizeHashtagPresetTags } from "~/lib/hashtag-preset-normalize";

describe("normalizeHashtagPresetTags", () => {
  it("adds # prefix, dedupes, and trims", () => {
    expect(normalizeHashtagPresetTags("foo #bar  bar  #baz")).toBe(
      "#foo #bar #baz"
    );
  });

  it("handles already-hashed tags", () => {
    expect(normalizeHashtagPresetTags("#a #b #a")).toBe("#a #b");
  });

  it("collapses whitespace", () => {
    expect(normalizeHashtagPresetTags("  #x   #y  ")).toBe("#x #y");
  });
});
