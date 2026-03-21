/**
 * Loader tests for app/routes/dashboard.admin._index (Overview tab).
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockIsReferralAdmin = vi.fn();
const mockGetAdminOverviewPageData = vi.fn();

vi.mock("~/features/auth", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock("~/features/referral/referral-admin.server", () => ({
  isReferralAdmin: (...args: unknown[]) => mockIsReferralAdmin(...args),
}));

vi.mock("~/features/admin/repositories/admin-overview-queries.server", () => ({
  getAdminOverviewPageData: (...args: unknown[]) =>
    mockGetAdminOverviewPageData(...args),
}));

import { loader } from "~/routes/dashboard.admin._index";

const minimalOverview = {
  rangePreset: "7d" as const,
  generatedAt: "2026-01-01T00:00:00.000Z",
  kpis: {
    activePaidUsers: { current: 1, previous: null, deltaPct: null },
    newUsers: { current: 0, previous: null, deltaPct: null },
    postsPublished: {
      current: 0,
      short: 0,
      long: 0,
      previous: null,
      deltaPct: null,
    },
    publishSuccessRate: 100,
    publishSuccessPrev: null,
    pendingPayoutSats: 0,
    actionRequiredCount: 0,
  },
  alerts: [] as Array<{
    id: string;
    severity: "warning" | "danger";
    message: string;
    href: string;
  }>,
  publishing: {
    stateMixShort: [] as Array<{ state: string; count: number }>,
    stateMixLong: [] as Array<{ state: string; count: number }>,
    dailyPublishesShort: [] as Array<{ day: string; count: number }>,
    scheduledQueueDepth: 0,
    failedShort: 0,
    cancelledShort: 0,
    avgPublishLatencyMs: null as number | null,
  },
  users: {
    activeUsersProxy: 0,
    signupsInRange: 0,
    avgPostsPerActiveUser: null as number | null,
  },
  referrals: {
    activeSubscriptions: 0,
    referralLinks: 0,
    pendingSats: 0,
    paidInRangeSats: 0,
    batchReadyCount: 0,
  },
  systemHealth: [] as Array<{
    id: string;
    label: string;
    status: "healthy" | "degraded" | "unknown" | "failing";
    detail?: string;
  }>,
};

describe("dashboard.admin._index loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ npub: "npub_admin" });
    mockIsReferralAdmin.mockReturnValue(true);
    mockGetAdminOverviewPageData.mockResolvedValue(minimalOverview);
  });

  it("returns 403 when user is not referral admin", async () => {
    mockIsReferralAdmin.mockReturnValue(false);
    const args: LoaderFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin"),
      params: {},
      context: {},
    };
    const res = await loader(args);
    expect(res.status).toBe(403);
  });

  it("returns overview DTO when admin", async () => {
    const args: LoaderFunctionArgs = {
      request: new Request("http://localhost/dashboard/admin"),
      params: {},
      context: {},
    };
    const res = await loader(args);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      rangePreset: "7d",
      kpis: { pendingPayoutSats: 0 },
    });
    expect(mockGetAdminOverviewPageData).toHaveBeenCalledOnce();
  });
});
