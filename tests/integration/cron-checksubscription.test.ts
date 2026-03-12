/**
 * Integration tests for cron subscription checker
 *
 * Tests app/routes/cron.checksubscription.tsx
 *
 * CRITICAL: This cron job handles subscription renewals and account disabling.
 * Comprehensive test coverage is essential.
 */

import { LN } from "@getalby/sdk/lnclient";
import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/user", () => ({
  getEnabledUsersWithSubscriptions: vi.fn(),
  disableUserAccount: vi.fn(),
}));

vi.mock("~/features/payments/data", () => ({
  createRenewalPayment: vi.fn(),
  getOwnerNwcWithRelayOverrides: vi.fn((ownerNwc: string) => ({
    credentials: ownerNwc,
    relays: [],
  })),
  updateUserSubscription: vi.fn(),
}));

vi.mock("~/lib/encryption.server", () => ({
  decrypt: vi.fn(),
}));

vi.mock("~/lib/nostr.messenger.server", () => ({
  sendNostrDirectMessage: vi.fn(),
}));

// Mock LN as a constructor class - use vi.hoisted to allow per-test configuration
const { MockLN } = vi.hoisted(() => {
  class MockLN {
    credentials: string;
    requestPayment: ReturnType<typeof vi.fn>;
    onPaid: ReturnType<typeof vi.fn>;
    onTimeout: ReturnType<typeof vi.fn>;

    constructor(credentials: string) {
      this.credentials = credentials;
      // Initialize methods as vi.fn() so they can be mocked per test
      this.requestPayment = vi.fn();
      this.onPaid = vi.fn().mockReturnValue(this); // Chainable
      this.onTimeout = vi.fn().mockReturnValue(this); // Chainable
    }
  }

  return { MockLN };
});

vi.mock("@getalby/sdk/lnclient", () => ({
  LN: vi.fn().mockImplementation(function (credentials: string) {
    return new MockLN(credentials);
  }),
  USD: vi.fn((amount: unknown) => ({ amount: amount as number })),
}));

vi.mock("~/features/payments/btc.rate", () => ({
  getBitcoinRate: vi.fn(),
}));

import {
  createRenewalPayment,
  updateUserSubscription,
} from "~/features/payments/data";
import {
  getEnabledUsersWithSubscriptions,
  disableUserAccount,
} from "~/features/user";
import { decrypt } from "~/lib/encryption.server";
import { sendNostrDirectMessage } from "~/lib/nostr.messenger.server";

describe("Cron Subscription Checker", () => {
  const TEST_USER_ID = "user-123";
  const TEST_PLAN_ID = "plan-123";
  const TEST_NPUB = "npub1test";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["OWNER_NWC"] = "test-owner-nwc";
    // Reset LN mock to default implementation - use function, not arrow, so it works as constructor
    const lnMock = LN as unknown as {
      mockImplementation: (
        fn: (credentials: string) => InstanceType<typeof MockLN>
      ) => void;
    };
    lnMock.mockImplementation(function (credentials: string) {
      return new MockLN(credentials);
    });
  });

  describe("Subscription Expiration Handling", () => {
    it("should disable accounts with expired subscriptions (no NWC)", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: false,
          encryptedNwc: null,
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: expiredDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (disableUserAccount as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
            })
          : {};

      expect(data.expired).toBe(1);
      expect(data.disabled).toBe(1);
      expect(disableUserAccount).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("should skip users without subscriptions", async () => {
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: false,
          encryptedNwc: null,
          Subscription: null,
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.checked).toBe(1);
      expect(data.expired).toBe(0);
      expect(disableUserAccount).not.toHaveBeenCalled();
    });

    it("should skip lifetime plans", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: false,
          encryptedNwc: null,
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: futureDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Lifetime Plan",
              price: 1000,
              enableLifetimeAccess: true,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.checked).toBe(1);
      expect(data.expired).toBe(0);
      expect(disableUserAccount).not.toHaveBeenCalled();
    });

    it("should skip active subscriptions", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: false,
          encryptedNwc: null,
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: futureDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.checked).toBe(1);
      expect(data.expired).toBe(0);
      expect(disableUserAccount).not.toHaveBeenCalled();
    });
  });

  describe("Automatic Renewal (NWC Enabled)", () => {
    it("should renew free plan automatically", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: true,
          encryptedNwc: "encrypted-nwc-string",
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: expiredDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Free Plan",
              price: 0,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (decrypt as ReturnType<typeof vi.fn>).mockReturnValue("decrypted-nwc");
      (createRenewalPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "free_renewal_123",
        status: "COMPLETED",
      });
      (updateUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );
      (sendNostrDirectMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.renewalAttempted).toBe(1);
      expect(data.renewalSuccess).toBe(1);
      expect(createRenewalPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          amount: 0,
          amountUsd: 0,
          invoice: "free_plan_renewal",
        })
      );
      expect(updateUserSubscription).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PLAN_ID,
        expect.stringContaining("free_renewal_")
      );
    });

    it("should attempt paid plan renewal with user NWC", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: true,
          encryptedNwc: "encrypted-nwc-string",
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: expiredDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      const mockInvoice = "lnbc100u1p3example";
      const mockPaymentHash = "payment-hash-123";
      const mockAmountSats = 25000;

      const mockLNInstance = new MockLN("test-nwc");
      mockLNInstance.requestPayment = vi.fn().mockResolvedValue({
        invoice: mockInvoice,
        paymentHash: mockPaymentHash,
        amount: mockAmountSats,
      });
      mockLNInstance.onPaid = vi.fn().mockReturnValue(mockLNInstance);
      mockLNInstance.onTimeout = vi.fn().mockReturnValue(mockLNInstance);

      // Mock the constructor to return our configured instance
      // Use a constructor function that returns the instance
      const lnMock = LN as unknown as {
        mockImplementation: (
          fn: (credentials: string) => typeof mockLNInstance
        ) => void;
      };
      lnMock.mockImplementation(function (_credentials: string) {
        return mockLNInstance;
      });

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (decrypt as ReturnType<typeof vi.fn>).mockReturnValue(
        "decrypted-user-nwc"
      );

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.renewalAttempted).toBe(1);
      expect(mockLNInstance.requestPayment).toHaveBeenCalled();
    });

    it("should handle renewal failure gracefully", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: true,
          encryptedNwc: "encrypted-nwc-string",
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: expiredDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (decrypt as ReturnType<typeof vi.fn>).mockReturnValue("decrypted-nwc");

      const mockLNInstance = new MockLN("test-nwc");
      mockLNInstance.requestPayment = vi
        .fn()
        .mockRejectedValue(new Error("Payment failed"));
      mockLNInstance.onPaid = vi.fn().mockReturnValue(mockLNInstance);
      mockLNInstance.onTimeout = vi.fn().mockReturnValue(mockLNInstance);

      const lnMock = LN as unknown as {
        mockImplementation: (fn: () => typeof mockLNInstance) => void;
      };
      lnMock.mockImplementation(() => mockLNInstance);

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.renewalAttempted).toBe(1);
      expect(data.renewalFailed).toBe(1);
      expect(data.renewalSuccess).toBe(0);
      // Should still disable account after failed renewal
      expect(disableUserAccount).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("should handle missing OWNER_NWC gracefully", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: true,
          encryptedNwc: "encrypted-nwc-string",
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: expiredDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      delete process.env["OWNER_NWC"];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (decrypt as ReturnType<typeof vi.fn>).mockReturnValue("decrypted-nwc");

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};
      const errors = Array.isArray(data.errors) ? data.errors : [];

      expect(data.renewalAttempted).toBe(1);
      expect(data.renewalFailed).toBe(1);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should handle decryption errors gracefully", async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const users = [
        {
          id: TEST_USER_ID,
          npub: TEST_NPUB,
          nwcEnabled: true,
          encryptedNwc: "invalid-encrypted-nwc",
          Subscription: {
            id: "sub-123",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: expiredDate,
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (decrypt as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.renewalAttempted).toBe(1);
      expect(data.renewalFailed).toBe(1);
      expect(disableUserAccount).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe("Error Handling", () => {
    it("should handle errors for individual users without stopping", async () => {
      const users = [
        {
          id: "user-1",
          npub: "npub1",
          nwcEnabled: false,
          encryptedNwc: null,
          Subscription: {
            id: "sub-1",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
        {
          id: "user-2",
          npub: "npub2",
          nwcEnabled: false,
          encryptedNwc: null,
          Subscription: {
            id: "sub-2",
            planId: TEST_PLAN_ID,
            plan: TEST_PLAN_ID,
            currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
            Plan: {
              id: TEST_PLAN_ID,
              name: "Basic Plan",
              price: 10,
              enableLifetimeAccess: false,
            },
          },
        },
      ];

      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockResolvedValue(users);
      (disableUserAccount as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce(undefined);

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};

      expect(data.checked).toBe(2);
      expect(data.expired).toBe(2);
      // Should continue processing even after error
      expect(disableUserAccount).toHaveBeenCalledTimes(2);
    });

    it("should return results even if getEnabledUsersWithSubscriptions fails", async () => {
      (
        getEnabledUsersWithSubscriptions as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("Database connection failed"));

      const { loader } = await import("~/routes/cron.checksubscription");
      const response = await (loader as () => Promise<Response>)();

      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              expired?: unknown;
              disabled?: unknown;
              checked?: unknown;
              renewalAttempted?: unknown;
              renewalSuccess?: unknown;
              renewalFailed?: unknown;
              success?: unknown;
              errors?: unknown;
            })
          : {};
      const errors = Array.isArray(data.errors) ? data.errors : [];

      expect(data.checked).toBe(0);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
      expect(
        errors.length > 0 && typeof errors[0] === "string" ? errors[0] : ""
      ).toContain("Database connection failed");
    });
  });
});
