import { describe, expect, it } from "vitest";

import { teardownVisibilityHandler } from "~/features/auth/signer";

describe("nostr-signer-manager lifecycle", () => {
  it("exports teardownVisibilityHandler", () => {
    expect(typeof teardownVisibilityHandler).toBe("function");
  });

  it("teardownVisibilityHandler can be called multiple times without throwing (idempotent)", () => {
    expect(() => {
      teardownVisibilityHandler();
      teardownVisibilityHandler();
    }).not.toThrow();
  });
});
