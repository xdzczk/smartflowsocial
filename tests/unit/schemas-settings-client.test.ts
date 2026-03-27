/**
 * Unit tests for settings client schemas
 * Tests app/lib/validation/schemas/settings.client.schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  updateRelaysClientSchema,
  updateTimezoneClientSchema,
  updateBlacklistClientSchema,
  createHashtagPresetClientSchema,
  updateHashtagPresetClientSchema,
  updateBlossomMirrorsClientSchema,
  updateNWCClientSchema,
  updateTagsClientSchema,
  queueTypeClientSchema,
} from "~/lib/validation/schemas/settings.client.schemas";

describe("settings.client.schemas", () => {
  describe("updateRelaysClientSchema", () => {
    it("accepts array of strings", () => {
      const result = updateRelaysClientSchema.parse({
        relays: ["wss://relay.example.com"],
      });
      expect(result.relays).toEqual(["wss://relay.example.com"]);
    });
    it("accepts empty array", () => {
      const result = updateRelaysClientSchema.parse({ relays: [] });
      expect(result.relays).toEqual([]);
    });
  });

  describe("updateTimezoneClientSchema", () => {
    it("accepts non-empty timezone", () => {
      const result = updateTimezoneClientSchema.parse({
        timezone: "America/New_York",
      });
      expect(result.timezone).toBe("America/New_York");
    });
    it("rejects empty timezone", () => {
      expect(() =>
        updateTimezoneClientSchema.parse({ timezone: "" })
      ).toThrow();
    });
  });

  describe("updateBlacklistClientSchema", () => {
    it("accepts array of strings", () => {
      const result = updateBlacklistClientSchema.parse({
        blacklist: ["npub1abc"],
      });
      expect(result.blacklist).toEqual(["npub1abc"]);
    });
  });

  describe("createHashtagPresetClientSchema", () => {
    it("parses name and tags", () => {
      const result = createHashtagPresetClientSchema.parse({
        name: "My Preset",
        tags: "#tag1 #tag2",
      });
      expect(result.name).toBe("My Preset");
      expect(result.tags).toBe("#tag1 #tag2");
    });
    it("rejects empty name", () => {
      expect(() =>
        createHashtagPresetClientSchema.parse({
          name: "",
          tags: "#x",
        })
      ).toThrow();
    });
    it("rejects empty tags", () => {
      expect(() =>
        createHashtagPresetClientSchema.parse({
          name: "Preset",
          tags: "",
        })
      ).toThrow();
    });
  });

  describe("updateHashtagPresetClientSchema", () => {
    it("parses id, name, tags", () => {
      const result = updateHashtagPresetClientSchema.parse({
        id: "preset-1",
        name: "Updated",
        tags: "#a #b",
      });
      expect(result.id).toBe("preset-1");
      expect(result.name).toBe("Updated");
    });
    it("rejects empty id", () => {
      expect(() =>
        updateHashtagPresetClientSchema.parse({
          id: "",
          name: "x",
          tags: "#x",
        })
      ).toThrow();
    });
  });

  describe("updateBlossomMirrorsClientSchema", () => {
    it("parses enableMirrorBlossom and mirrorUrls", () => {
      const result = updateBlossomMirrorsClientSchema.parse({
        enableMirrorBlossom: true,
        mirrorUrls: ["https://mirror.example.com"],
      });
      expect(result.enableMirrorBlossom).toBe(true);
      expect(result.mirrorUrls).toHaveLength(1);
    });
  });

  describe("updateNWCClientSchema", () => {
    it("parses nwcEnabled and optional nwcString", () => {
      const result = updateNWCClientSchema.parse({
        nwcEnabled: false,
      });
      expect(result.nwcEnabled).toBe(false);
      expect(result.nwcString).toBeUndefined();
    });
    it("accepts nwcString", () => {
      const result = updateNWCClientSchema.parse({
        nwcEnabled: true,
        nwcString: "nostr+walletconnect://...",
      });
      expect(result.nwcString).toBe("nostr+walletconnect://...");
    });
  });

  describe("updateTagsClientSchema", () => {
    it("parses optional hashtags and showHashTagsInPosts default", () => {
      const result = updateTagsClientSchema.parse({});
      expect(result.showHashTagsInPosts).toBe(false);
    });
    it("accepts hashtags string", () => {
      const result = updateTagsClientSchema.parse({
        hashtags: "#foo",
        showHashTagsInPosts: true,
      });
      expect(result.hashtags).toBe("#foo");
      expect(result.showHashTagsInPosts).toBe(true);
    });
  });

  describe("queueTypeClientSchema", () => {
    it("parses INTERVAL with intervalHours", () => {
      const result = queueTypeClientSchema.parse({
        name: "Queue",
        scheduleType: "INTERVAL",
        intervalHours: "2",
      });
      expect(result.name).toBe("Queue");
      expect(result.scheduleType).toBe("INTERVAL");
      expect(result.intervalHours).toBe("2");
    });
    it("parses INTERVAL with useGlobalInterval", () => {
      const result = queueTypeClientSchema.parse({
        name: "Queue",
        scheduleType: "INTERVAL",
        useGlobalInterval: true,
      });
      expect(result.useGlobalInterval).toBe(true);
    });
    it("rejects INTERVAL without intervalHours or useGlobalInterval", () => {
      expect(() =>
        queueTypeClientSchema.parse({
          name: "Queue",
          scheduleType: "INTERVAL",
        })
      ).toThrow();
    });
    it("parses FIXED_SLOTS with slots", () => {
      const result = queueTypeClientSchema.parse({
        name: "Queue",
        scheduleType: "FIXED_SLOTS",
        slots: "5",
      });
      expect(result.scheduleType).toBe("FIXED_SLOTS");
      expect(result.slots).toBe("5");
    });
    it("rejects FIXED_SLOTS without slots", () => {
      expect(() =>
        queueTypeClientSchema.parse({
          name: "Queue",
          scheduleType: "FIXED_SLOTS",
        })
      ).toThrow();
    });
    it("parses WEEKLY_SLOTS with weeklySlots", () => {
      const result = queueTypeClientSchema.parse({
        name: "Queue",
        scheduleType: "WEEKLY_SLOTS",
        weeklySlots: [{ dayOfWeek: 1, time: "09:00" }],
      });
      expect(result.scheduleType).toBe("WEEKLY_SLOTS");
      expect(result.weeklySlots).toHaveLength(1);
    });
    it("rejects WEEKLY_SLOTS without weeklySlots", () => {
      expect(() =>
        queueTypeClientSchema.parse({
          name: "Queue",
          scheduleType: "WEEKLY_SLOTS",
        })
      ).toThrow();
    });
    it("rejects invalid colorToken", () => {
      expect(() =>
        queueTypeClientSchema.parse({
          name: "Queue",
          scheduleType: "INTERVAL",
          intervalHours: "1",
          colorToken: "invalid",
        })
      ).toThrow();
    });
  });
});
