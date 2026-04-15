import { describe, expect, it } from "vitest";

import {
  bulkPostsActionSchema,
  saveAsDraftSchema,
  signAndScheduleSchema,
} from "~/lib/validation/schemas/posts.schemas";
import {
  createQueueTypeSchema,
  topUpSubscriptionSchema,
  updateBlossomMirrorsSchema,
  updateNWCSchema,
  updatePreferredNostrClientSchema,
  updatePrimarySignerProfileSchema,
  updateQueueTypeSchema,
  updateScheduleIntervalsSchema,
  updateTagsSchema,
} from "~/lib/validation/schemas/settings.schemas";

describe("posts/settings schema branch coverage", () => {
  describe("posts schema branch transforms", () => {
    it("parses signAndSchedule arrays and coercions", () => {
      const result = signAndScheduleSchema.parse({
        signedEvents: [
          JSON.stringify({
            id: "id1",
            pubkey: "pk",
            created_at: 1,
            kind: 1,
            content: "c",
            tags: [],
            sig: "sig",
          }),
        ],
        nostrEvent: [
          JSON.stringify({
            created_at: 1,
            kind: 1,
            content: "c",
            tags: [],
          }),
        ],
        caption: [JSON.stringify(["a", "b"]), JSON.stringify("text"), "{}"],
        fileUrl: [JSON.stringify(["u1", 2]), JSON.stringify("u2"), ""],
        queueType: ["q"],
        isRecyclable: ["true", "FALSE"],
      });

      expect(result.caption).toEqual(["a b", "text", "[object Object]"]);
      expect(result.fileUrl).toEqual([["u1"], ["u2"], []]);
      expect(result.isRecyclable).toEqual([true, false]);
      expect(result.originalPostId).toEqual([]);
    });

    it("rejects invalid signed event payloads", () => {
      expect(() =>
        signAndScheduleSchema.parse({
          signedEvents: ["[]"],
          nostrEvent: [
            JSON.stringify({ created_at: 1, kind: 1, content: "c", tags: [] }),
          ],
          caption: [""],
          fileUrl: [""],
          queueType: [""],
          isRecyclable: ["false"],
        })
      ).toThrow("Invalid signed event format");
    });

    it("parses saveAsDraft fileUrl fallback and union schema members", () => {
      const draft = saveAsDraftSchema.parse({
        fileUrl: [JSON.stringify(["u1", 2]), "u2", ""],
        caption: [""],
        queueType: ["unassigned"],
        scheduledFor: [""],
      });
      expect(draft.fileUrl).toEqual([["u1"], ["u2"], []]);

      const unionPreview = bulkPostsActionSchema.parse({
        _action: "_upload_images_preview",
        uploadResults: JSON.stringify([{ success: true }]),
        scheduledDates: [],
        queueTypes: [],
      });
      expect(unionPreview._action).toBe("_upload_images_preview");

      const unionDraft = bulkPostsActionSchema.parse({
        _action: "save_as_draft",
        fileUrl: [JSON.stringify(["u1"])],
        caption: [""],
        queueType: ["q"],
        scheduledFor: [""],
      });
      expect(unionDraft._action).toBe("save_as_draft");
    });
  });

  describe("settings schema branch refinements", () => {
    it("validates schedule intervals with specific error branches", () => {
      expect(() =>
        updateScheduleIntervalsSchema.parse({ scheduleIntervals: "abc" })
      ).toThrow("Must be a number");
      expect(() =>
        updateScheduleIntervalsSchema.parse({ scheduleIntervals: "-1" })
      ).toThrow("Must be positive");
      expect(() =>
        updateScheduleIntervalsSchema.parse({ scheduleIntervals: "0.3" })
      ).toThrow("Schedule interval must be 0.25");

      const ok = updateScheduleIntervalsSchema.parse({
        scheduleIntervals: "0.25\n1\n2",
      });
      expect(ok.scheduleIntervals).toEqual(["0.25", "1", "2"]);
    });

    it("normalizes mirror URLs and boolean flags", () => {
      const parsed = updateBlossomMirrorsSchema.parse({
        enableMirrorBlossom: "on",
        mirrorUrls: "https://a.com/\nhttps://b.com",
      });
      expect(parsed.enableMirrorBlossom).toBe(true);
      expect(parsed.mirrorUrls).toEqual(["https://a.com", "https://b.com"]);
      expect(() =>
        updateBlossomMirrorsSchema.parse({
          mirrorUrls: "http://bad.example.com",
        })
      ).toThrow("All mirror URLs must start with https://");
    });

    it("handles preferred nostr client custom URL edge cases", () => {
      const allowEmptyCustom = updatePreferredNostrClientSchema.parse({
        preferredNostrClient: "CUSTOM",
        customNostrClientBaseUrl: "   ",
      });
      expect(allowEmptyCustom.customNostrClientBaseUrl).toBeNull();

      expect(() =>
        updatePreferredNostrClientSchema.parse({
          preferredNostrClient: "CUSTOM",
          customNostrClientBaseUrl: "https://",
        })
      ).toThrow("Invalid URL format");
    });

    it("coerces nwc toggles and accepts free-form tags payload", () => {
      const enabled = updateNWCSchema.parse({
        nwcEnabled: "on",
        nwcString: "nostr+walletconnect://abc",
      });
      expect(enabled.nwcEnabled).toBe(true);

      const disabled = updateNWCSchema.parse({
        nwcEnabled: "false",
      });
      expect(disabled.nwcEnabled).toBe(false);

      const tags = updateTagsSchema.parse({ hashtags: "nostr,ai" });
      expect(tags.hashtags).toBe("nostr,ai");
    });

    it("checks primary signer profile requirements", () => {
      expect(() =>
        updatePrimarySignerProfileSchema.parse({
          method: "bunker_input",
          bunkerInput: "",
        })
      ).toThrow("Bunker input is required");

      expect(() =>
        updatePrimarySignerProfileSchema.parse({
          method: "nostrconnect_uri",
          uri: "",
          relays: "",
        })
      ).toThrow();

      const valid = updatePrimarySignerProfileSchema.parse({
        method: "nostrconnect_uri",
        uri: "nostrconnect://x",
        relays: "wss://one\nwss://two",
      });
      expect(valid.relays).toEqual(["wss://one", "wss://two"]);
    });

    it("enforces queue schedule mode requirements", () => {
      expect(() =>
        createQueueTypeSchema.parse({
          name: "Q",
          scheduleType: "INTERVAL",
          intervalHours: "",
        })
      ).toThrow("Interval hours or use global interval is required");

      expect(() =>
        updateQueueTypeSchema.parse({
          id: "id",
          name: "Q",
          colorToken: "slate",
          scheduleType: "FIXED_SLOTS",
          slots: "",
        })
      ).toThrow("Slots are required");

      const weekly = createQueueTypeSchema.parse({
        name: "Q",
        scheduleType: "WEEKLY_SLOTS",
        weeklySlots: JSON.stringify([{ dayOfWeek: 1, time: "10:30" }]),
      });
      expect(weekly.weeklySlots?.[0]?.time).toBe("10:30");
    });

    it("validates top-up cadence/month constraints", () => {
      expect(() =>
        topUpSubscriptionSchema.parse({
          targetPlanId: "pro",
          paymentLane: "lightning_one_time",
          billingCadence: "yearly",
          accessDurationMonths: 6,
        })
      ).toThrow("Yearly top-ups must be 12 months");

      expect(() =>
        topUpSubscriptionSchema.parse({
          targetPlanId: "pro",
          paymentLane: "lightning_one_time",
          billingCadence: "monthly",
          accessDurationMonths: 2,
        })
      ).toThrow("Monthly top-ups must be 1, 3, or 6 months");

      const valid = topUpSubscriptionSchema.parse({
        targetPlanId: "pro",
        paymentLane: "nwc_auto_renew",
        billingCadence: "monthly",
        accessDurationMonths: "3",
      });
      expect(valid.accessDurationMonths).toBe(3);
    });
  });
});
