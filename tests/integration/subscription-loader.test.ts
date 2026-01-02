/**
 * Integration tests for subscription/billing loader
 *
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/subscription/billing-loader.cy.ts
 *
 * Migrated from: tests/e2e/subscription/billing-loader.cy.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock Prisma to prevent $use errors
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $use: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/payments/subscriptions.server", () => ({
  requireAnySubscription: vi.fn(),
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/settings/settings-loader.server", () => ({
  loadSettingsData: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments/subscriptions.server";
import { loadSettingsData } from "~/features/settings/settings-loader.server";
import { loader } from "~/routes/dashboard.settings";

describe("Subscription/Billing Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined,
    );
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined,
    );
    (loadSettingsData as ReturnType<typeof vi.fn>).mockResolvedValue({
      timezone: "UTC",
      relays: [],
      giveawayBlacklist: [],
      scheduleIntervals: [],
      queueTypes: [],
      uploadProvider: "s3",
      enableMirrorBlossom: false,
      mirrorUploadUrls: [],
      hashTagPresets: [],
      nwcEnabled: false,
      maskedNwcString: null,
      nwcLastUsed: null,
      subscription: null,
      availablePlans: [],
      paymentHistory: [],
      isChild: false,
      hasAccountsAccess: false,
      accounts: [],
      mutedList: [],
      filterMuted: false,
      hidePostsFromLowTrustUsers: false,
    });
  });

  describe("Subscription Settings Loader", () => {
    it("should load subscription settings data for authenticated user", async () => {
      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );
      const loaderArgs: {
        request: Request;
        params?: Record<string, string>;
        context?: Record<string, unknown>;
      } = { request };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireAnySubscription).toHaveBeenCalledWith("user-123");
      expect(requireFeatureAccess).toHaveBeenCalledWith("user-123", "settings");
      expect(loadSettingsData).toHaveBeenCalledWith("user-123");
      expect(data).toHaveProperty("subscription");
      expect(data).toHaveProperty("availablePlans");
      expect(data).toHaveProperty("paymentHistory");
    });

    it("should return subscription data structure", async () => {
      const mockData = {
        timezone: "America/New_York",
        relays: [],
        giveawayBlacklist: [],
        scheduleIntervals: [],
        queueTypes: [],
        uploadProvider: "s3",
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
        hashTagPresets: [],
        nwcEnabled: false,
        maskedNwcString: null,
        nwcLastUsed: null,
        subscription: {
          id: "sub-123",
          planId: "premium",
          status: "ACTIVE",
          Plan: {
            id: "premium",
            name: "Premium Plan",
          },
        },
        availablePlans: [
          { id: "basic", name: "Basic", price: 1000 },
          { id: "premium", name: "Premium", price: 2000 },
        ],
        paymentHistory: [{ id: "pay-1", amount: 2000, createdAt: new Date() }],
        isChild: false,
        hasAccountsAccess: false,
        accounts: [],
        mutedList: [],
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
      };

      (loadSettingsData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData,
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );
      const loaderArgs: {
        request: Request;
        params?: Record<string, string>;
        context?: Record<string, unknown>;
      } = { request };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data.subscription).toHaveProperty("status", "ACTIVE");
      expect(data.subscription).toHaveProperty("planId", "premium");
      expect(data.availablePlans).toHaveLength(2);
      const paymentHistory = data.paymentHistory as Array<unknown>;
      expect(paymentHistory).toHaveLength(1);
    });

    it("should handle free plan users (no subscription)", async () => {
      const mockData = {
        timezone: "UTC",
        relays: [],
        giveawayBlacklist: [],
        scheduleIntervals: [],
        queueTypes: [],
        uploadProvider: "s3",
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
        hashTagPresets: [],
        nwcEnabled: false,
        maskedNwcString: null,
        nwcLastUsed: null,
        subscription: null,
        availablePlans: [
          { id: "basic", name: "Basic", price: 1000 },
          { id: "premium", name: "Premium", price: 2000 },
        ],
        paymentHistory: [],
        isChild: false,
        hasAccountsAccess: false,
        accounts: [],
        mutedList: [],
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
      };

      (loadSettingsData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData,
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );
      const loaderArgs: {
        request: Request;
        params?: Record<string, string>;
        context?: Record<string, unknown>;
      } = { request };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data.subscription).toBeNull();
      expect(data.availablePlans).toHaveLength(2);
      const paymentHistory = data.paymentHistory as Array<unknown>;
      expect(paymentHistory).toHaveLength(0);
    });

    it("should handle expired subscription", async () => {
      const mockData = {
        timezone: "UTC",
        relays: [],
        giveawayBlacklist: [],
        scheduleIntervals: [],
        queueTypes: [],
        uploadProvider: "s3",
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
        hashTagPresets: [],
        nwcEnabled: false,
        maskedNwcString: null,
        nwcLastUsed: null,
        subscription: {
          id: "sub-123",
          planId: "premium",
          status: "EXPIRED",
          Plan: {
            id: "premium",
            name: "Premium Plan",
          },
        },
        availablePlans: [
          { id: "basic", name: "Basic", price: 1000 },
          { id: "premium", name: "Premium", price: 2000 },
        ],
        paymentHistory: [],
        isChild: false,
        hasAccountsAccess: false,
        accounts: [],
        mutedList: [],
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
      };

      (loadSettingsData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData,
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );
      const loaderArgs: {
        request: Request;
        params?: Record<string, string>;
        context?: Record<string, unknown>;
      } = { request };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data.subscription).toHaveProperty("status", "EXPIRED");
    });

    it("should include payment history when available", async () => {
      const mockData = {
        timezone: "UTC",
        relays: [],
        giveawayBlacklist: [],
        scheduleIntervals: [],
        queueTypes: [],
        uploadProvider: "s3",
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
        hashTagPresets: [],
        nwcEnabled: false,
        maskedNwcString: null,
        nwcLastUsed: null,
        subscription: {
          id: "sub-123",
          planId: "premium",
          status: "ACTIVE",
          Plan: {
            id: "premium",
            name: "Premium Plan",
          },
        },
        availablePlans: [],
        paymentHistory: [
          { id: "pay-1", amount: 2000, createdAt: new Date("2024-01-01") },
          { id: "pay-2", amount: 2000, createdAt: new Date("2024-02-01") },
          { id: "pay-3", amount: 2000, createdAt: new Date("2024-03-01") },
        ],
        isChild: false,
        hasAccountsAccess: false,
        accounts: [],
        mutedList: [],
        filterMuted: false,
        hidePostsFromLowTrustUsers: false,
      };

      (loadSettingsData as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockData,
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );
      const loaderArgs: {
        request: Request;
        params?: Record<string, string>;
        context?: Record<string, unknown>;
      } = { request };
      const response = await loader(loaderArgs);
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      const paymentHistory = data.paymentHistory as Array<{
        amount: number;
        [key: string]: unknown;
      }>;
      expect(paymentHistory).toHaveLength(3);
      expect(paymentHistory[0]).toHaveProperty("amount", 2000);
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required"),
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );

      await expect(loader({ request })).rejects.toThrow(
        "Authentication required",
      );
    });

    it("should handle subscription requirement errors", async () => {
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Subscription required"),
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );

      await expect(loader({ request })).rejects.toThrow(
        "Subscription required",
      );
    });

    it("should handle feature access errors", async () => {
      (requireFeatureAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Feature access denied"),
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );

      await expect(loader({ request })).rejects.toThrow(
        "Feature access denied",
      );
    });

    it("should handle data loading errors", async () => {
      (loadSettingsData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=subscription",
      );

      await expect(loader({ request })).rejects.toThrow("Database error");
    });
  });
});
