/**
 * Unit tests for settings schemas (server/shared)
 * Tests app/lib/validation/schemas/settings.schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  relayUrlSchema,
  updateTimezoneSchema,
  updateRelaysSchema,
  updateBlacklistSchema,
  updateScheduleIntervalsSchema,
  updatePreferredNostrClientSchema,
  createHashtagPresetSchema,
  updateHashtagPresetSchema,
  uploadProviderSchema,
  updateUploadProviderSchema,
} from "~/lib/validation/schemas/settings.schemas";

describe("settings.schemas", () => {
  describe("relayUrlSchema", () => {
    it("accepts valid wss URL", () => {
      expect(relayUrlSchema.parse("wss://relay.example.com")).toBe(
        "wss://relay.example.com"
      );
    });
    it("rejects non-wss", () => {
      expect(() => relayUrlSchema.parse("https://x.com")).toThrow();
    });
    it("rejects invalid domain", () => {
      expect(() => relayUrlSchema.parse("wss://")).toThrow();
    });
  });

  describe("updateTimezoneSchema", () => {
    it("accepts non-empty timezone", () => {
      const result = updateTimezoneSchema.parse({
        timezone: "Europe/London",
      });
      expect(result.timezone).toBe("Europe/London");
    });
    it("rejects empty timezone", () => {
      expect(() => updateTimezoneSchema.parse({ timezone: "" })).toThrow();
    });
  });

  describe("updateRelaysSchema", () => {
    it("transforms newline-separated string to array and validates relay URLs", () => {
      const result = updateRelaysSchema.parse({
        relays: "wss://relay.example.com\nwss://other.relay.com",
      });
      expect(result.relays).toHaveLength(2);
      expect(result.relays).toContain("wss://relay.example.com");
    });
    it("rejects when no valid relays", () => {
      expect(() =>
        updateRelaysSchema.parse({ relays: "https://invalid.com" })
      ).toThrow();
    });
  });

  describe("updateBlacklistSchema", () => {
    it("transforms newline-separated string and validates npub prefix", () => {
      const result = updateBlacklistSchema.parse({
        blacklist: "npub1abc\nnpub1def",
      });
      expect(result.blacklist).toHaveLength(2);
      expect(result.blacklist).toContain("npub1abc");
    });
    it("rejects items not starting with npub", () => {
      expect(() =>
        updateBlacklistSchema.parse({
          blacklist: "npub1ok\ninvalid",
        })
      ).toThrow();
    });
  });

  describe("updateScheduleIntervalsSchema", () => {
    it("accepts allowed intervals (0.25, 0.5, 1)", () => {
      const result = updateScheduleIntervalsSchema.parse({
        scheduleIntervals: "0.25\n0.5\n1\n24",
      });
      expect(result.scheduleIntervals).toEqual([0.25, 0.5, 1, 24]);
    });
    it("rejects invalid interval", () => {
      expect(() =>
        updateScheduleIntervalsSchema.parse({
          scheduleIntervals: "0.33",
        })
      ).toThrow();
    });
  });

  describe("updatePreferredNostrClientSchema", () => {
    it("accepts preset without custom URL", () => {
      const result = updatePreferredNostrClientSchema.parse({
        preferredNostrClient: "PRIMAL",
      });
      expect(result.preferredNostrClient).toBe("PRIMAL");
    });
    it("accepts CUSTOM with valid https URL", () => {
      const result = updatePreferredNostrClientSchema.parse({
        preferredNostrClient: "CUSTOM",
        customNostrClientBaseUrl: "https://my.client.com",
      });
      expect(result.preferredNostrClient).toBe("CUSTOM");
      expect(result.customNostrClientBaseUrl).toBe("https://my.client.com");
    });
    it("rejects CUSTOM with non-https URL", () => {
      expect(() =>
        updatePreferredNostrClientSchema.parse({
          preferredNostrClient: "CUSTOM",
          customNostrClientBaseUrl: "http://insecure.com",
        })
      ).toThrow();
    });
  });

  describe("createHashtagPresetSchema", () => {
    it("parses name and tags", () => {
      const result = createHashtagPresetSchema.parse({
        name: "Preset",
        tags: "#a #b",
      });
      expect(result.name).toBe("Preset");
      expect(result.tags).toBe("#a #b");
    });
    it("rejects empty name", () => {
      expect(() =>
        createHashtagPresetSchema.parse({ name: "", tags: "#x" })
      ).toThrow();
    });
  });

  describe("updateHashtagPresetSchema", () => {
    it("parses id, name, tags", () => {
      const result = updateHashtagPresetSchema.parse({
        id: "id1",
        name: "N",
        tags: "#t",
      });
      expect(result.id).toBe("id1");
      expect(result.name).toBe("N");
    });
  });

  describe("uploadProviderSchema", () => {
    it("accepts enum values", () => {
      expect(uploadProviderSchema.parse("S3")).toBe("S3");
      expect(uploadProviderSchema.parse("BLOSSOM_PRIMAL")).toBe(
        "BLOSSOM_PRIMAL"
      );
      expect(uploadProviderSchema.parse("BLOSSOM_CUSTOM")).toBe(
        "BLOSSOM_CUSTOM"
      );
    });
    it("rejects invalid value", () => {
      expect(() => uploadProviderSchema.parse("INVALID")).toThrow();
    });
  });

  describe("updateUploadProviderSchema", () => {
    it("parses non-CUSTOM provider", () => {
      const result = updateUploadProviderSchema.parse({
        uploadProvider: "BLOSSOM_PRIMAL",
      });
      expect(result.uploadProvider).toBe("BLOSSOM_PRIMAL");
      expect(result.customBlossomUrl).toBeNull();
    });
    it("rejects BLOSSOM_CUSTOM without customBlossomUrl", () => {
      expect(() =>
        updateUploadProviderSchema.parse({
          uploadProvider: "BLOSSOM_CUSTOM",
        })
      ).toThrow();
    });
    it("accepts BLOSSOM_CUSTOM with valid https URL", () => {
      const result = updateUploadProviderSchema.parse({
        uploadProvider: "BLOSSOM_CUSTOM",
        customBlossomUrl: "https://blossom.example.com",
      });
      expect(result.customBlossomUrl).toBe("https://blossom.example.com");
    });
    it("strips trailing slash from customBlossomUrl", () => {
      const result = updateUploadProviderSchema.parse({
        uploadProvider: "BLOSSOM_CUSTOM",
        customBlossomUrl: "https://blossom.example.com/",
      });
      expect(result.customBlossomUrl).toBe("https://blossom.example.com");
    });
    it("rejects BLOSSOM_CUSTOM with non-https URL", () => {
      expect(() =>
        updateUploadProviderSchema.parse({
          uploadProvider: "BLOSSOM_CUSTOM",
          customBlossomUrl: "http://insecure.com",
        })
      ).toThrow();
    });
  });
});
