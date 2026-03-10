/**
 * Unit tests for Nostr client URL utilities
 * Tests app/lib/nostr-client-urls.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("nostr-tools", () => ({
  nip19: {
    neventEncode: vi.fn((x: { id: string }) => `nevent1${x.id}`),
    noteEncode: vi.fn((hex: string) => `note1${hex}`),
  },
}));

import {
  getNostrClientConfig,
  eventUrl,
  articleUrl,
  profileUrl,
  getNostrClientDisplayName,
  getNostrClientUrlsFromUser,
} from "~/lib/nostr-client-urls";

describe("Nostr Client URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNostrClientConfig", () => {
    it("returns Primal config for PRIMAL", () => {
      const config = getNostrClientConfig("PRIMAL", null);
      expect(config.baseUrl).toBe("https://primal.net");
      expect(config.pathStyle).toBe("primal");
    });

    it("returns Damus config for DAMUS", () => {
      const config = getNostrClientConfig("DAMUS", null);
      expect(config.baseUrl).toBe("https://damus.io");
      expect(config.pathStyle).toBe("bech32_bare");
    });

    it("returns fallback for null/undefined", () => {
      expect(getNostrClientConfig(null, null).baseUrl).toBe(
        "https://primal.net"
      );
      expect(getNostrClientConfig(undefined, undefined).baseUrl).toBe(
        "https://primal.net"
      );
    });

    it("returns CUSTOM baseUrl when CUSTOM and valid URL", () => {
      const config = getNostrClientConfig(
        "CUSTOM",
        "https://my.client.com/path"
      );
      expect(config.baseUrl).toBe("https://my.client.com");
      expect(config.pathStyle).toBe("primal");
    });

    it("returns fallback when CUSTOM and invalid URL", () => {
      const config = getNostrClientConfig("CUSTOM", "not-a-url");
      expect(config.baseUrl).toBe("https://primal.net");
    });

    it("returns fallback when CUSTOM and empty URL", () => {
      const config = getNostrClientConfig("CUSTOM", "");
      expect(config.baseUrl).toBe("https://primal.net");
    });

    it("returns preset for AMETHYST, NOSTUR, NOSTRUDEL, IRIS, YAKIHONNE", () => {
      expect(getNostrClientConfig("AMETHYST", null).baseUrl).toBe(
        "https://amethyst.social"
      );
      expect(getNostrClientConfig("NOSTUR", null).baseUrl).toBe(
        "https://nostur.com"
      );
      expect(getNostrClientConfig("NOSTRUDEL", null).baseUrl).toBe(
        "https://nostrudel.ninja"
      );
      expect(getNostrClientConfig("IRIS", null).baseUrl).toBe(
        "https://iris.to"
      );
      expect(getNostrClientConfig("YAKIHONNE", null).baseUrl).toBe(
        "https://yakihonne.com"
      );
    });
  });

  describe("eventUrl", () => {
    it("returns empty for empty eventId", () => {
      expect(
        eventUrl("", { baseUrl: "https://primal.net", pathStyle: "primal" })
      ).toBe("");
    });
    it("returns empty for non-string eventId", () => {
      expect(
        eventUrl(null as unknown as string, {
          baseUrl: "https://x",
          pathStyle: "primal",
        })
      ).toBe("");
    });

    it("returns primal style /e/hex", () => {
      const config = {
        baseUrl: "https://primal.net",
        pathStyle: "primal" as const,
      };
      expect(eventUrl("abc123", config)).toContain("/e/");
      expect(eventUrl("abc123", config)).toContain("primal.net");
    });

    it("returns bech32_bare style with nevent", () => {
      const config = {
        baseUrl: "https://damus.io",
        pathStyle: "bech32_bare" as const,
      };
      expect(eventUrl("a".repeat(64), config)).toContain("nevent1");
      expect(eventUrl("a".repeat(64), config)).toContain("damus.io");
    });

    it("returns nostrudel style /n/nevent", () => {
      const config = {
        baseUrl: "https://nostrudel.ninja",
        pathStyle: "nostrudel" as const,
      };
      expect(eventUrl("a".repeat(64), config)).toContain("/n/nevent1");
    });

    it("returns yakihonne style /note/nevent", () => {
      const config = {
        baseUrl: "https://yakihonne.com",
        pathStyle: "yakihonne" as const,
      };
      expect(eventUrl("a".repeat(64), config)).toContain("/note/nevent1");
    });

    it("returns iris style with note1", () => {
      const config = { baseUrl: "https://iris.to", pathStyle: "iris" as const };
      expect(eventUrl("a".repeat(64), config)).toContain("note1");
    });

    it("strips trailing slash from baseUrl", () => {
      const config = {
        baseUrl: "https://primal.net/",
        pathStyle: "primal" as const,
      };
      expect(eventUrl("a".repeat(64), config)).not.toMatch(/\/\/e\//);
    });
  });

  describe("articleUrl", () => {
    it("returns empty for empty idOrNaddr", () => {
      const config = {
        baseUrl: "https://primal.net",
        pathStyle: "primal" as const,
      };
      expect(articleUrl("", config)).toBe("");
    });
    it("returns empty for non-string", () => {
      expect(
        articleUrl(null as unknown as string, {
          baseUrl: "https://x",
          pathStyle: "primal",
        })
      ).toBe("");
    });

    it("returns primal style /a/ for naddr", () => {
      const config = {
        baseUrl: "https://primal.net",
        pathStyle: "primal" as const,
      };
      const url = articleUrl("naddr1xxx", config);
      expect(url).toBe("https://primal.net/a/naddr1xxx");
    });

    it("returns bech32_bare with naddr as path", () => {
      const config = {
        baseUrl: "https://damus.io",
        pathStyle: "bech32_bare" as const,
      };
      expect(articleUrl("naddr1xxx", config)).toBe(
        "https://damus.io/naddr1xxx"
      );
    });
    it("returns bech32_bare with /a/ for non-naddr", () => {
      const config = {
        baseUrl: "https://damus.io",
        pathStyle: "bech32_bare" as const,
      };
      expect(articleUrl("abc", config)).toBe("https://damus.io/a/abc");
    });

    it("returns nostrudel style /articles/", () => {
      const config = {
        baseUrl: "https://nostrudel.ninja",
        pathStyle: "nostrudel" as const,
      };
      expect(articleUrl("naddr1x", config)).toBe(
        "https://nostrudel.ninja/articles/naddr1x"
      );
    });

    it("returns yakihonne style /article/", () => {
      const config = {
        baseUrl: "https://yakihonne.com",
        pathStyle: "yakihonne" as const,
      };
      expect(articleUrl("naddr1x", config)).toBe(
        "https://yakihonne.com/article/naddr1x"
      );
    });

    it("returns iris /a/ for non-hex idOrNaddr", () => {
      const config = { baseUrl: "https://iris.to", pathStyle: "iris" as const };
      expect(articleUrl("naddr1x", config)).toBe("https://iris.to/a/naddr1x");
    });
  });

  describe("profileUrl", () => {
    it("returns empty for empty npub", () => {
      const config = {
        baseUrl: "https://primal.net",
        pathStyle: "primal" as const,
      };
      expect(profileUrl("", config)).toBe("");
    });

    it("returns /p/npub for primal style", () => {
      const config = {
        baseUrl: "https://primal.net",
        pathStyle: "primal" as const,
      };
      expect(profileUrl("npub1abc", config)).toBe(
        "https://primal.net/p/npub1abc"
      );
    });

    it("returns bare npub for bech32_bare", () => {
      const config = {
        baseUrl: "https://damus.io",
        pathStyle: "bech32_bare" as const,
      };
      expect(profileUrl("npub1abc", config)).toBe("https://damus.io/npub1abc");
    });
  });

  describe("getNostrClientDisplayName", () => {
    it("returns names for presets", () => {
      expect(getNostrClientDisplayName("PRIMAL")).toBe("Primal");
      expect(getNostrClientDisplayName("DAMUS")).toBe("Damus");
      expect(getNostrClientDisplayName("CUSTOM")).toBe("client");
      expect(getNostrClientDisplayName("AMETHYST")).toBe("Amethyst");
      expect(getNostrClientDisplayName("NOSTUR")).toBe("Nostur");
      expect(getNostrClientDisplayName("NOSTRUDEL")).toBe("noStrudel");
      expect(getNostrClientDisplayName("IRIS")).toBe("Iris");
      expect(getNostrClientDisplayName("YAKIHONNE")).toBe("Yakihonne");
    });

    it("returns Primal for unknown", () => {
      expect(getNostrClientDisplayName(null)).toBe("Primal");
      expect(getNostrClientDisplayName("UNKNOWN")).toBe("Primal");
    });
  });

  describe("getNostrClientUrlsFromUser", () => {
    it("returns config and URL helpers from user", () => {
      const result = getNostrClientUrlsFromUser({
        preferredNostrClient: "DAMUS",
        customNostrClientBaseUrl: null,
      });
      expect(result.config.baseUrl).toBe("https://damus.io");
      expect(result.viewEventLabel).toBe("Damus");
      expect(typeof result.eventUrl).toBe("function");
      expect(typeof result.articleUrl).toBe("function");
      expect(typeof result.profileUrl).toBe("function");
    });

    it("handles null user", () => {
      const result = getNostrClientUrlsFromUser(null);
      expect(result.config.baseUrl).toBe("https://primal.net");
    });

    it("handles undefined user", () => {
      const result = getNostrClientUrlsFromUser(undefined);
      expect(result.config.baseUrl).toBe("https://primal.net");
    });

    it("returns working eventUrl/articleUrl/profileUrl from helpers", () => {
      const result = getNostrClientUrlsFromUser({
        preferredNostrClient: "PRIMAL",
        customNostrClientBaseUrl: null,
      });
      expect(result.eventUrl("a".repeat(64))).toContain("/e/");
      expect(result.articleUrl("naddr1x")).toContain("/a/");
      expect(result.profileUrl("npub1abc")).toContain("/p/");
    });
  });
});
