import { describe, expect, it } from "vitest";

import { teardownVisibilityHandler } from "~/lib/nostr-signer-manager.client";

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
