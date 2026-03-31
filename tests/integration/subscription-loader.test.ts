/**
 * Integration tests for subscription/billing loader
 *
 * Tests the loader function logic directly, without requiring a browser.
 * For UI rendering tests, see tests/e2e/subscription/billing-loader.cy.ts
 *
 * Migrated from: tests/e2e/subscription/billing-loader.cy.ts
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
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
}));

vi.mock(
  "~/features/settings/settings-loader.server",
  async (importOriginal) => {
    const actual = await importOriginal<typeof SettingsLoaderServer>();
    return {
      ...actual,
      loadSettingsData: vi.fn(),
    };
  }
);

vi.mock("~/features/settings", () => ({
  SettingsPage: () => null,
  SettingsPageSkeleton: () => null,
  SettingsAwaitError: () => null,
  SettingsResolvedLoaderProvider: ({ children }: { children?: unknown }) =>
    children ?? null,
  handleSettingsAction: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import type * as SettingsLoaderServer from "~/features/settings/settings-loader.server";
import { loadSettingsData } from "~/features/settings/settings-loader.server";
import { loader } from "~/routes/dashboard.settings";

/** Loader uses `defer` for document requests; `_data` forces synchronous JSON (tests). */
function settingsLoaderJsonRequest(query: string) {
  const u = new URL("http://localhost:3000/dashboard/settings");
  const q = new URLSearchParams(query);
  q.set("_data", "routes/dashboard.settings");
  u.search = q.toString();
  return new Request(u.toString());
}

describe("Subscription/Billing Loader Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-123");
    (requireAnySubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
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
      const request = settingsLoaderJsonRequest("tab=billing");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = (await loader(loaderArgs)) as Response;
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(response.status).toBe(200);
      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(requireAnySubscription).toHaveBeenCalledWith("user-123");
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
        mockData
      );

      const request = settingsLoaderJsonRequest("tab=billing");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = (await loader(loaderArgs)) as Response;
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data["subscription"]).toHaveProperty("status", "ACTIVE");
      expect(data["subscription"]).toHaveProperty("planId", "premium");
      expect(data["availablePlans"]).toHaveLength(2);
      const paymentHistory = data["paymentHistory"] as unknown[];
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
        mockData
      );

      const request = settingsLoaderJsonRequest("tab=billing");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = (await loader(loaderArgs)) as Response;
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data["subscription"]).toBeNull();
      expect(data["availablePlans"]).toHaveLength(2);
      const paymentHistory = data["paymentHistory"] as unknown[];
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
        mockData
      );

      const request = settingsLoaderJsonRequest("tab=billing");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = (await loader(loaderArgs)) as Response;
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      expect(data["subscription"]).toHaveProperty("status", "EXPIRED");
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
        mockData
      );

      const request = settingsLoaderJsonRequest("tab=billing");
      const loaderArgs: LoaderFunctionArgs = {
        request,
        params: {},
        context: {},
      };
      const response = (await loader(loaderArgs)) as Response;
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as Record<string, unknown>)
          : {};

      const paymentHistory = data["paymentHistory"] as Array<{
        amount: number;
        [key: string]: unknown;
      }>;
      expect(paymentHistory).toHaveLength(3);
      expect(paymentHistory[0]).toHaveProperty("amount", 2000);
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      // requireUserId throws a Response (redirect), not an Error
      const redirectResponse = new Response(null, {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
      (requireUserId as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw redirectResponse;
      });

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=billing"
      );

      // Loader catches Response errors and returns them
      const response = (await loader({
        request,
        params: {},
        context: {},
      })) as Response;
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(401);
    });

    it("should handle subscription requirement errors", async () => {
      // requireAnySubscription throws a Response (redirect), not an Error
      const redirectResponse = new Response(null, {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw redirectResponse;
        }
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=billing"
      );

      // Loader catches Response errors and returns them
      const response = (await loader({
        request,
        params: {},
        context: {},
      })) as Response;
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(403);
    });

    it("should handle subscription gate errors", async () => {
      const redirectResponse = new Response(null, {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
      (requireAnySubscription as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw redirectResponse;
        }
      );

      const request = new Request(
        "http://localhost:3000/dashboard/settings?tab=billing"
      );

      // Loader catches Response errors and returns them
      const response = (await loader({
        request,
        params: {},
        context: {},
      })) as Response;
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(403);
    });

    it("should handle data loading errors", async () => {
      (loadSettingsData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error")
      );

      const request = settingsLoaderJsonRequest("tab=billing");

      const response = (await loader({
        request,
        params: {},
        context: {},
      })) as Response;
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { error?: { message?: string } })
          : {};

      expect(data.error).toBeDefined();
      const error =
        data.error &&
        typeof data.error === "object" &&
        !Array.isArray(data.error)
          ? (data.error as { message?: string })
          : {};
      const errorMessage =
        typeof error.message === "string" ? error.message : "";
      expect(errorMessage).toContain("Database error");
    });
  });
});
