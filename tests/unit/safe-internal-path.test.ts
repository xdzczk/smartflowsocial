import { describe, expect, it } from "vitest";

import { safeInternalPath } from "~/lib/safe-internal-path";

describe("safeInternalPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/dashboard/posts?tab=scheduled")).toBe(
      "/dashboard/posts?tab=scheduled"
    );
    expect(safeInternalPath("/")).toBe("/");
  });

  it("rejects missing and external targets", () => {
    expect(safeInternalPath(undefined)).toBe("/dashboard");
    expect(safeInternalPath("")).toBe("/dashboard");
    expect(safeInternalPath("https://evil.example/phish")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example")).toBe("/dashboard");
    expect(safeInternalPath("\\\\evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil.example")).toBe("/dashboard");
    expect(safeInternalPath("\\/evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/dashboard\\@evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/%2f/evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/%5Cevil.example")).toBe("/dashboard");
    expect(safeInternalPath("/dashboard\nset-cookie")).toBe("/dashboard");
  });

  it("uses the caller fallback", () => {
    expect(safeInternalPath("https://evil.example", "/login")).toBe("/login");
  });
});
