/**
 * Unit tests for giveaway actions (create, preview, reroll, lock, cancel, markPaidOut, etc.).
 * Tests app/features/giveaway/giveaway-actions.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUserById = vi.fn();
const mockGetUserSubscription = vi.fn();
const mockGetGiveawayPlanLimits = vi.fn();
const mockGetUserPlanType = vi.fn();
const mockGetPostsInScope = vi.fn();
const mockFetchGiveawayParticipants = vi.fn();
const mockProcessGiveawayParticipants = vi.fn();
const mockGetParticipantPubkeysForFollowScope = vi.fn();
const mockRunGiveawaySelection = vi.fn();
const mockRunGiveawaySelectionPerEngagement = vi.fn();
const mockCreateGiveawayRow = vi.fn();
const mockUpdateGiveawayRow = vi.fn();
const mockFindGiveawayByIdAndUser = vi.fn();
const mockDeleteGiveawayById = vi.fn();
const mockListGiveawaysByUserFromRepo = vi.fn();

vi.mock("~/features/user", () => ({
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

vi.mock("~/features/payments/data", () => ({
  getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
}));

vi.mock("~/features/payments/types", () => ({
  getUserPlanType: (...args: unknown[]) => mockGetUserPlanType(...args),
  getGiveawayPlanLimits: (...args: unknown[]) =>
    mockGetGiveawayPlanLimits(...args),
}));

vi.mock("~/features/giveaway/giveaway-scope.server", () => ({
  getPostsInScope: (...args: unknown[]) => mockGetPostsInScope(...args),
}));

vi.mock("~/features/giveaway/giveaway.server", () => ({
  fetchGiveawayParticipants: (...args: unknown[]) =>
    mockFetchGiveawayParticipants(...args),
}));

vi.mock("~/features/giveaway/giveaway-loader.server", () => ({
  processGiveawayParticipants: (...args: unknown[]) =>
    mockProcessGiveawayParticipants(...args),
  getParticipantPubkeysForFollowScope: (...args: unknown[]) =>
    mockGetParticipantPubkeysForFollowScope(...args),
}));

vi.mock("~/features/giveaway/giveaway-selection.server", () => ({
  runGiveawaySelection: (...args: unknown[]) =>
    mockRunGiveawaySelection(...args),
  runGiveawaySelectionPerEngagement: (...args: unknown[]) =>
    mockRunGiveawaySelectionPerEngagement(...args),
}));

vi.mock(
  "~/features/giveaway/repositories/giveaway-actions-data.server",
  () => ({
    createGiveaway: (...args: unknown[]) => mockCreateGiveawayRow(...args),
    updateGiveaway: (...args: unknown[]) => mockUpdateGiveawayRow(...args),
    findGiveawayByIdAndUser: (...args: unknown[]) =>
      mockFindGiveawayByIdAndUser(...args),
    deleteGiveawayById: (...args: unknown[]) => mockDeleteGiveawayById(...args),
    listGiveawaysByUser: (...args: unknown[]) =>
      mockListGiveawaysByUserFromRepo(...args),
  })
);

import type { Giveaway } from "~/features/giveaway/data/giveaway-prisma-types.server";
import {
  createGiveaway,
  getGiveawayById,
  previewGiveaway,
  rerollGiveaway,
  lockGiveaway,
  cancelGiveaway,
  deleteGiveaway,
  markGiveawayPaidOut,
  listGiveawaysByUser,
} from "~/features/giveaway/giveaway-actions.server";

describe("giveaway-actions", () => {
  const userId = "user-1";
  const giveawayId = "gw-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserPlanType.mockReturnValue("PAID");
    mockGetGiveawayPlanLimits.mockReturnValue({
      canUseQueueScope: true,
      maxWinnerCount: 10,
    });
    mockGetUserSubscription.mockResolvedValue({});
    mockGetUserById.mockResolvedValue({
      id: userId,
      npub: "npub_user",
      filterMuted: false,
      mutedList: null,
    });
    mockProcessGiveawayParticipants.mockImplementation((events: unknown[]) =>
      Promise.resolve(events)
    );
    mockFetchGiveawayParticipants.mockResolvedValue({
      relatedEvents: [
        { id: "ev1", pubkey: "pk1", created_at: 1, kind: 7 },
        { id: "ev2", pubkey: "pk2", created_at: 2, kind: 7 },
      ],
    });
    mockRunGiveawaySelection.mockReturnValue([
      {
        pubkey: "pk1",
        npub: "npub1",
        qualifyingActions: [{ kind: 7, eventId: "ev1" }],
      },
    ]);
  });

  describe("getGiveawayById", () => {
    it("returns giveaway from repo", async () => {
      const g = {
        id: giveawayId,
        userId,
        status: "DRAFT",
      } as unknown as Giveaway;
      mockFindGiveawayByIdAndUser.mockResolvedValue(g);
      const result = await getGiveawayById(giveawayId, userId);
      expect(result).toEqual(g);
      expect(mockFindGiveawayByIdAndUser).toHaveBeenCalledWith(
        giveawayId,
        userId
      );
    });

    it("returns null when not found", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue(null);
      const result = await getGiveawayById(giveawayId, userId);
      expect(result).toBeNull();
    });
  });

  describe("createGiveaway", () => {
    it("calls repo create with expected shape", async () => {
      const created = {
        id: giveawayId,
        userId,
        status: "DRAFT",
        scopeType: "PERIOD",
        scopeReference: { days: 7 },
        winnerCount: 2,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
      } as unknown as Giveaway;
      mockCreateGiveawayRow.mockResolvedValue(created);

      await createGiveaway(userId, {
        scopeType: "PERIOD",
        scopeReference: { days: 7 },
        engagementTypes: ["REACTION", "ZAP"],
        winnerCount: 2,
      });

      expect(mockCreateGiveawayRow).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          scopeType: "PERIOD",
          scopeReference: { days: 7 },
          winnerCount: 2,
          status: "DRAFT",
          selectionMode: "UNIQUE_USER",
        })
      );
    });

    it("throws when queue scope used and plan cannot use queue", async () => {
      mockGetGiveawayPlanLimits.mockReturnValue({
        canUseQueueScope: false,
        maxWinnerCount: 10,
      });

      await expect(
        createGiveaway(userId, {
          scopeType: "QUEUE",
          scopeReference: { queueId: "q1" },
          engagementTypes: ["REACTION"],
          winnerCount: 1,
        })
      ).rejects.toThrow("Queue filter is available on paid plans");
    });
  });

  describe("previewGiveaway", () => {
    it("returns error when giveaway not found", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue(null);
      const result = await previewGiveaway(userId, giveawayId);
      expect(result.winners).toEqual([]);
      expect(result.error).toBe("Giveaway not found");
    });

    it("returns error when status is not DRAFT or PREVIEWED", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "LOCKED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: null,
      } as unknown as Giveaway);
      const result = await previewGiveaway(userId, giveawayId);
      expect(result.error).toBe("Giveaway cannot be previewed");
    });

    it("fetches participants, runs selection, updates status and snapshot", async () => {
      mockGetPostsInScope.mockResolvedValue([
        {
          id: "post-1",
          signedEvent: { id: "ev1" },
          currentState: "PUBLISHED",
          queueType: {},
        },
      ]);
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "DRAFT",
        scopeType: "PERIOD",
        scopeReference: { days: 7 },
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: null,
      } as unknown as Giveaway);
      mockUpdateGiveawayRow.mockResolvedValue({});

      const result = await previewGiveaway(userId, giveawayId);

      expect(result.error).toBeUndefined();
      expect(result.winners).toHaveLength(1);
      expect(mockUpdateGiveawayRow).toHaveBeenCalledWith(
        giveawayId,
        expect.objectContaining({ status: "PREVIEWED" })
      );
    });

    it("uses runGiveawaySelectionPerEngagement when engagementConfig present", async () => {
      mockGetPostsInScope.mockResolvedValue([
        {
          id: "post-1",
          signedEvent: { id: "ev1" },
          currentState: "PUBLISHED",
          queueType: {},
        },
      ]);
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "DRAFT",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 2,
        engagementTypes: ["REACTION", "ZAP"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: { REACTION: { winnerCount: 1, satsPerWinner: 100 } },
        engagementWeights: null,
        filters: null,
        winnerSnapshot: null,
      } as unknown as Giveaway);
      mockRunGiveawaySelectionPerEngagement.mockReturnValue([
        {
          pubkey: "pk1",
          npub: "npub1",
          qualifyingActions: [],
          engagementType: "REACTION",
          satsPerWinner: 100,
        },
      ]);
      mockUpdateGiveawayRow.mockResolvedValue({});

      await previewGiveaway(userId, giveawayId);

      expect(mockRunGiveawaySelectionPerEngagement).toHaveBeenCalled();
      expect(mockRunGiveawaySelection).not.toHaveBeenCalled();
    });
  });

  describe("rerollGiveaway", () => {
    it("returns error when not found", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue(null);
      const result = await rerollGiveaway(userId, giveawayId);
      expect(result.error).toBe("Giveaway not found");
    });

    it("returns error when status is not PREVIEWED", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "DRAFT",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: null,
      } as unknown as Giveaway);
      const result = await rerollGiveaway(userId, giveawayId);
      expect(result.error).toBe("Only previewed giveaways can be rerolled");
    });
  });

  describe("lockGiveaway", () => {
    it("returns error when not found", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue(null);
      const result = await lockGiveaway(userId, giveawayId);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Giveaway not found");
    });

    it("updates status to LOCKED when PREVIEWED and has winners", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "PREVIEWED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [
          { pubkey: "pk1", npub: "npub1", qualifyingActions: [] },
        ],
      } as unknown as Giveaway);
      mockUpdateGiveawayRow.mockResolvedValue({});

      const result = await lockGiveaway(userId, giveawayId);

      expect(result.success).toBe(true);
      expect(mockUpdateGiveawayRow).toHaveBeenCalled();
      const updatePayload = mockUpdateGiveawayRow.mock.calls[0]?.[1] as {
        status?: string;
        payoutState?: Record<string, { status?: string }>;
      };
      expect(updatePayload).toMatchObject({
        status: "LOCKED",
        payoutState: { pk1: { status: "pending" } },
      });
    });
  });

  describe("cancelGiveaway", () => {
    it("returns error when LOCKED or PAID_OUT", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "LOCKED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [],
      } as unknown as Giveaway);
      const result = await cancelGiveaway(userId, giveawayId);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel");
    });

    it("updates status to CANCELLED", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "DRAFT",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: null,
      } as unknown as Giveaway);
      mockUpdateGiveawayRow.mockResolvedValue({});

      const result = await cancelGiveaway(userId, giveawayId);
      expect(result.success).toBe(true);
      expect(mockUpdateGiveawayRow).toHaveBeenCalledWith(
        giveawayId,
        expect.objectContaining({ status: "CANCELLED" })
      );
    });
  });

  describe("markGiveawayPaidOut", () => {
    it("returns error when status is not LOCKED", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "PREVIEWED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [],
      } as unknown as Giveaway);
      const result = await markGiveawayPaidOut(userId, giveawayId);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Only locked");
    });

    it("returns error when winners pending and no override", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "LOCKED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [
          { pubkey: "pk1", npub: "npub1", qualifyingActions: [] },
        ],
        payoutState: {
          pk1: { status: "pending", updatedAt: new Date().toISOString() },
        },
      } as unknown as Giveaway);

      const result = await markGiveawayPaidOut(userId, giveawayId);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Mark each winner");
      expect(mockUpdateGiveawayRow).not.toHaveBeenCalled();
    });

    it("updates status to PAID_OUT when all winners settled", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "LOCKED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [
          { pubkey: "pk1", npub: "npub1", qualifyingActions: [] },
        ],
        payoutState: {
          pk1: { status: "sent", updatedAt: new Date().toISOString() },
        },
      } as unknown as Giveaway);
      mockUpdateGiveawayRow.mockResolvedValue({});

      const result = await markGiveawayPaidOut(userId, giveawayId);
      expect(result.success).toBe(true);
      expect(mockUpdateGiveawayRow).toHaveBeenCalledWith(
        giveawayId,
        expect.objectContaining({ status: "PAID_OUT" })
      );
    });

    it("updates status to PAID_OUT with override when pending", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "LOCKED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [
          { pubkey: "pk1", npub: "npub1", qualifyingActions: [] },
        ],
        payoutState: {
          pk1: { status: "pending", updatedAt: new Date().toISOString() },
        },
      } as unknown as Giveaway);
      mockUpdateGiveawayRow.mockResolvedValue({});

      const result = await markGiveawayPaidOut(userId, giveawayId, {
        completeOverrideReason: "Paid offline manually today",
      });
      expect(result.success).toBe(true);
      expect(mockUpdateGiveawayRow).toHaveBeenCalledWith(
        giveawayId,
        expect.objectContaining({ status: "PAID_OUT" })
      );
    });
  });

  describe("deleteGiveaway", () => {
    it("returns error when LOCKED or PAID_OUT", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "LOCKED",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: [],
      } as unknown as Giveaway);
      const result = await deleteGiveaway(userId, giveawayId);
      expect(result.success).toBe(false);
      expect(mockDeleteGiveawayById).not.toHaveBeenCalled();
    });

    it("calls deleteGiveawayById when DRAFT", async () => {
      mockFindGiveawayByIdAndUser.mockResolvedValue({
        id: giveawayId,
        userId,
        status: "DRAFT",
        scopeType: "PERIOD",
        scopeReference: {},
        winnerCount: 1,
        engagementTypes: ["REACTION"],
        selectionMode: "UNIQUE_USER",
        engagementConfig: null,
        engagementWeights: null,
        filters: null,
        winnerSnapshot: null,
      } as unknown as Giveaway);
      mockDeleteGiveawayById.mockResolvedValue({} as unknown as Giveaway);

      const result = await deleteGiveaway(userId, giveawayId);
      expect(result.success).toBe(true);
      expect(mockDeleteGiveawayById).toHaveBeenCalledWith(giveawayId);
    });
  });

  describe("listGiveawaysByUser", () => {
    it("returns list from repo", async () => {
      const list = [{ id: "gw1", userId, status: "DRAFT" }] as Giveaway[];
      mockListGiveawaysByUserFromRepo.mockResolvedValue(list);
      const result = await listGiveawaysByUser(userId);
      expect(result).toEqual(list);
      expect(mockListGiveawaysByUserFromRepo).toHaveBeenCalledWith(
        userId,
        undefined
      );
    });
  });
});
