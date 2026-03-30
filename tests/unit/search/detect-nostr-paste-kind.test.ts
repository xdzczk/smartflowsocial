import { describe, expect, it } from "vitest";

import { detectNostrPasteKind } from "~/features/search/utils/detect-nostr-paste-kind";

describe("detectNostrPasteKind", () => {
  it("returns null for short input", () => {
    expect(detectNostrPasteKind("a")).toBeNull();
  });

  it("detects note, nevent, naddr, hex, url", () => {
    expect(detectNostrPasteKind("note1abcdef")).toBe("Note");
    expect(detectNostrPasteKind("nostr:nevent1xyz")).toBe("Event");
    expect(detectNostrPasteKind("naddr1abc")).toBe("Addressable");
    expect(detectNostrPasteKind("a".repeat(64))).toBe("Hex id");
    expect(detectNostrPasteKind("https://primal.net/x")).toBe("URL");
  });
});
