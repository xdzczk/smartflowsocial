import { describe, expect, it, vi, beforeEach } from "vitest";

// --- Mocks (must be hoisted for vi.mock factories) ---
const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    payoutRun: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockPrisma = {
    $transaction: vi.fn(),
    payoutItem: {
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    payoutAttempt: {
      create: vi.fn(),
      update: vi.fn(),
    },
    payoutRun: {
      update: vi.fn(),
    },
  };

  return { mockTx, mockPrisma };
});

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("~/features/user", () => ({
  getDecryptedUserNWC: vi.fn(),
}));

vi.mock("~/features/auth/profile.server", () => ({
  fetchPrimalProfileData: vi.fn(),
  processPrimalData: vi.fn(),
}));

vi.mock("~/features/referral/lnurl-pay.server", () => ({
  fetchInvoiceFromLnurlPay: vi.fn(),
}));

vi.mock("@getalby/sdk", () => ({
  NWCClient: class {
    payInvoice = vi.fn(async () => ({ preimage: "test-preimage" }));
    close = vi.fn();
    constructor(_args: unknown) {}
  },
}));

import { executeCampaignPayoutBatch } from "~/features/payments/services/payout-executor.server";
import { fetchInvoiceFromLnurlPay } from "~/features/referral/lnurl-pay.server";
import { getDecryptedUserNWC } from "~/features/user";

describe("executeCampaignPayoutBatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    );
  });

  it("creates a run and skips when creator has no NWC", async () => {
    const mockedGetDecryptedUserNWC = vi.mocked(getDecryptedUserNWC);
    mockedGetDecryptedUserNWC.mockResolvedValue(null);

    mockTx.payoutRun.findUnique.mockResolvedValue(null);
    mockTx.payoutRun.create.mockResolvedValue({ id: "run_1", startedAt: null });
    mockTx.payoutRun.update.mockResolvedValue({ id: "run_1" });

    const res = await executeCampaignPayoutBatch({
      scope: "CONTEST",
      contestId: "c1",
      creatorUserId: "u1",
      trigger: "autorun",
      walletMode: "nwc_creator",
      winners: [
        {
          winnerPubkeyHex: "a".repeat(64),
          amountSats: 100,
          winnerNpub: "npub1",
        },
      ],
    });

    expect(res.eligible).toBe(false);
    expect(res.walletMode).toBe("manual");
    expect(res.runId).toBe("run_1");
    expect(mockTx.payoutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "skipped" }) as unknown,
      })
    );
  });

  it("pays one invoice via NWC and marks item paid", async () => {
    const mockedGetDecryptedUserNWC = vi.mocked(getDecryptedUserNWC);
    mockedGetDecryptedUserNWC.mockResolvedValue("nostr+walletconnect://test");
    const mockedFetchInvoiceFromLnurlPay = vi.mocked(fetchInvoiceFromLnurlPay);
    mockedFetchInvoiceFromLnurlPay.mockResolvedValue("lnbc1testinvoice");

    mockTx.payoutRun.findUnique.mockResolvedValue(null);
    mockTx.payoutRun.create.mockResolvedValue({ id: "run_2", startedAt: null });
    mockTx.payoutRun.update.mockResolvedValue({ id: "run_2" });

    mockPrisma.payoutItem.upsert.mockResolvedValue({
      id: "item_1",
      status: "pending",
      attemptCount: 0,
    });
    mockPrisma.payoutItem.update.mockResolvedValue({ id: "item_1" });
    mockPrisma.payoutAttempt.create.mockResolvedValue({ id: "att_1" });
    mockPrisma.payoutAttempt.update.mockResolvedValue({ id: "att_1" });
    mockPrisma.payoutRun.update.mockResolvedValue({ id: "run_2" });

    const res = await executeCampaignPayoutBatch({
      scope: "GIVEAWAY",
      giveawayId: "g1",
      creatorUserId: "u1",
      trigger: "manual_trigger",
      walletMode: "nwc_creator",
      winners: [
        {
          winnerPubkeyHex: "b".repeat(64),
          amountSats: 123,
          winnerNpub: "npub1test",
          lnAddressSnapshot: "alice@example.com",
        },
      ],
    });

    expect(res.eligible).toBe(true);
    expect(res.totals.paid).toBe(1);
    expect(mockPrisma.payoutAttempt.create).toHaveBeenCalled();
    expect(mockPrisma.payoutItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "paid" }) as unknown,
      })
    );
    expect(mockPrisma.payoutRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: expect.any(String) as unknown,
        }) as unknown,
      })
    );
  });
});
