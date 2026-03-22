/**
 * Unit tests for app/features/admin/repositories/admin-overview-stats-data.server.ts
 */

import { ReferralEarningStatus, SubscriptionStatus } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockUserCount: vi.fn(),
  mockUserCountEnabled: vi.fn(),
  mockSubscriptionCount: vi.fn(),
  mockPostGroupBy: vi.fn(),
  mockLongFormGroupBy: vi.fn(),
  mockReferralCount: vi.fn(),
  mockEarningGroupBy: vi.fn(),
  mockEarningAggregate: vi.fn(),
  mockGetReferrersEligibleForPayout: vi.fn(),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    user: {
      count: (...args: unknown[]) => {
        const where = args[0] as
          | { where?: { isEnabled?: boolean } }
          | undefined;
        if (where?.where?.isEnabled === true) {
          return mocks.mockUserCountEnabled();
        }
        return mocks.mockUserCount();
      },
    },
    subscription: { count: mocks.mockSubscriptionCount },
    post: { groupBy: mocks.mockPostGroupBy },
    longFormPost: { groupBy: mocks.mockLongFormGroupBy },
    referral: { count: mocks.mockReferralCount },
    referralEarning: {
      groupBy: mocks.mockEarningGroupBy,
      aggregate: mocks.mockEarningAggregate,
    },
  },
}));

vi.mock("~/features/referral/referral-payout.server", () => ({
  getReferrersEligibleForPayout: (...args: unknown[]) =>
    mocks.mockGetReferrersEligibleForPayout(...args),
}));

import { getAdminOverviewStats } from "~/features/admin/repositories/admin-overview-stats-data.server";

describe("getAdminOverviewStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUserCount.mockResolvedValue(10);
    mocks.mockUserCountEnabled.mockResolvedValue(7);
    mocks.mockSubscriptionCount.mockImplementation(
      (args: { where?: Record<string, unknown> }) => {
        const w = args.where;
        const notClause = w?.["NOT"] as { planId?: string } | undefined;
        if (notClause?.planId === "free") {
          return Promise.resolve(2);
        }
        if (w?.["status"] === SubscriptionStatus.ACTIVE) {
          return Promise.resolve(5);
        }
        return Promise.resolve(0);
      }
    );
    mocks.mockPostGroupBy.mockResolvedValue([
      { currentState: "SCHEDULED", _count: { _all: 5 } },
      { currentState: "PUBLISHED", _count: { _all: 12 } },
    ]);
    mocks.mockLongFormGroupBy.mockResolvedValue([
      { currentState: "DRAFT", _count: { _all: 2 } },
    ]);
    mocks.mockReferralCount.mockResolvedValue(4);
    mocks.mockEarningGroupBy.mockResolvedValue([
      { status: ReferralEarningStatus.PENDING, _count: { _all: 2 } },
      { status: ReferralEarningStatus.PAID, _count: { _all: 8 } },
      { status: ReferralEarningStatus.FAILED, _count: { _all: 1 } },
    ]);
    mocks.mockEarningAggregate.mockResolvedValue({
      _sum: { commissionSats: 1500 },
    });
    mocks.mockGetReferrersEligibleForPayout.mockResolvedValue([
      { referrerNpub: "npub_a", pendingSats: 2000 },
      { referrerNpub: "npub_b", pendingSats: 5000 },
    ]);
  });

  it("returns stable shape with aggregated values", async () => {
    const stats = await getAdminOverviewStats();

    expect(stats.usersTotal).toBe(10);
    expect(stats.usersEnabled).toBe(7);
    expect(stats.subscriptionsActivePaid).toBe(2);
    expect(stats.subscriptionsActiveAll).toBe(5);
    expect(stats.referralLinkCount).toBe(4);
    expect(stats.referralPendingCommissionSats).toBe(1500);
    expect(stats.referralPayoutEligibleCount).toBe(2);
    expect(stats.referralPayoutEligiblePreviewNpubs).toEqual([
      "npub_a",
      "npub_b",
    ]);
    expect(stats.referralEarningsByStatus).toEqual({
      pending: 2,
      paid: 8,
      failed: 1,
    });
    expect(stats.postsByCurrentState).toEqual([
      { currentState: "PUBLISHED", count: 12 },
      { currentState: "SCHEDULED", count: 5 },
    ]);
    expect(stats.longFormByCurrentState).toEqual([
      { currentState: "DRAFT", count: 2 },
    ]);
  });

  it("sorts state breakdowns by count descending", async () => {
    mocks.mockPostGroupBy.mockResolvedValue([
      { currentState: "A", _count: { _all: 1 } },
      { currentState: "B", _count: { _all: 99 } },
    ]);
    const stats = await getAdminOverviewStats();
    expect(stats.postsByCurrentState[0]).toEqual({
      currentState: "B",
      count: 99,
    });
  });

  it("handles null pending commission sum as zero", async () => {
    mocks.mockEarningAggregate.mockResolvedValue({
      _sum: { commissionSats: null },
    });
    const stats = await getAdminOverviewStats();
    expect(stats.referralPendingCommissionSats).toBe(0);
  });
});
