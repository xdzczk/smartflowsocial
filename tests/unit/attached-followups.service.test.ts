import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCancelPostJob,
  mockFindMany,
  mockDeleteMany,
  mockUpdateMany,
  mockCreateMany,
  mockUpdate,
  mockPrisma,
} = vi.hoisted(() => {
  const mockCancelPostJob = vi.fn();
  const mockFindMany = vi.fn();
  const mockDeleteMany = vi.fn();
  const mockUpdateMany = vi.fn();
  const mockCreateMany = vi.fn();
  const mockUpdate = vi.fn();
  const mockTx = {
    post: {
      findMany: mockFindMany,
      deleteMany: mockDeleteMany,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
    postStateTransition: {
      createMany: mockCreateMany,
    },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(mockTx)
    ),
    post: {
      findMany: vi.fn(),
    },
  };
  return {
    mockCancelPostJob,
    mockFindMany,
    mockDeleteMany,
    mockUpdateMany,
    mockCreateMany,
    mockUpdate,
    mockPrisma,
  };
});

vi.mock("~/infra/queue/queue-operations.server", () => ({
  cancelPostJob: mockCancelPostJob,
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: mockPrisma,
}));

import {
  cascadeAttachedReschedule,
  cascadeCancelAttachedFollowups,
  cascadeDeleteAttachedFollowups,
  resyncAttachedChildrenAfterParentMutation,
} from "~/features/posts/scheduling/services/attached-followups.server";

describe("attached-followups service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cascadeDeleteAttachedFollowups deletes descendants and cancels jobs", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: "child-1" }, { id: "child-2" }])
      .mockResolvedValueOnce([]);

    const ids = await cascadeDeleteAttachedFollowups({
      rootPostId: "root-1",
      userId: "user-1",
    });

    expect(ids).toEqual(["child-1", "child-2"]);
    expect(mockDeleteMany).toHaveBeenCalled();
    expect(mockCancelPostJob).toHaveBeenCalledTimes(2);
  });

  it("cascadeCancelAttachedFollowups invalidates signed payloads and transitions state", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "child-1",
          parentScheduledActionId: "root-1",
          scheduledAtUtc: new Date(),
          followUpTimingMode: "fixed_datetime",
          followUpOffsetSeconds: null,
          currentState: "SCHEDULED",
        },
      ])
      .mockResolvedValueOnce([]);

    const ids = await cascadeCancelAttachedFollowups({
      rootPostId: "root-1",
      userId: "user-1",
      targetState: "CANCELLED",
      reason: "cascade",
    });

    expect(ids).toEqual(["child-1"]);
    expect(mockUpdateMany).toHaveBeenCalled();
    expect(mockCreateMany).toHaveBeenCalled();
    expect(mockCancelPostJob).toHaveBeenCalledWith("child-1");
  });

  it("cascadeAttachedReschedule clamps fixed_datetime child to parent time", async () => {
    const parentTime = new Date("2026-01-02T10:00:00.000Z");
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "child-1",
          parentScheduledActionId: "root-1",
          scheduledAtUtc: new Date("2026-01-02T09:00:00.000Z"),
          followUpTimingMode: "fixed_datetime",
          followUpOffsetSeconds: null,
          currentState: "SCHEDULED",
        },
      ])
      .mockResolvedValueOnce([]);

    await cascadeAttachedReschedule({
      rootPostId: "root-1",
      userId: "user-1",
      parentScheduledAtUtc: parentTime,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher typing uses any
        data: expect.objectContaining({
          scheduledAtUtc: parentTime,
          signingState: "stale",
        }),
      })
    );
  });

  it("cascadeAttachedReschedule recomputes offset_from_parent child time", async () => {
    const parentTime = new Date("2026-01-02T10:00:00.000Z");
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "child-offset",
          parentScheduledActionId: "root-1",
          scheduledAtUtc: new Date("2026-01-02T11:00:00.000Z"),
          followUpTimingMode: "offset_from_parent",
          followUpOffsetSeconds: 7200,
          currentState: "SCHEDULED",
        },
      ])
      .mockResolvedValueOnce([]);

    await cascadeAttachedReschedule({
      rootPostId: "root-1",
      userId: "user-1",
      parentScheduledAtUtc: parentTime,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher typing uses any
        data: expect.objectContaining({
          scheduledAtUtc: new Date("2026-01-02T12:00:00.000Z"),
          signingState: "stale",
        }),
      })
    );
  });

  it("resyncAttachedChildrenAfterParentMutation marks children stale/invalidated", async () => {
    (mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "child-signed", signedEvent: { id: "x" } },
      { id: "child-unsigned", signedEvent: null },
    ]);

    await resyncAttachedChildrenAfterParentMutation({
      parentPostId: "root-1",
      userId: "user-1",
      parentPredictedEventId: "parent-new-id",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher typing uses any
        data: expect.objectContaining({
          expectedParentEventId: "parent-new-id",
          signingState: "stale",
        }),
      })
    );
    expect(mockUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher typing uses any
        data: expect.objectContaining({
          expectedParentEventId: "parent-new-id",
          signingState: "invalidated",
        }),
      })
    );
  });
});
