import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockQueueTypeFindFirst,
  mockQueueTypeUpdate,
  mockPostFindMany,
  mockPostUpdate,
  mockPostUpdateMany,
  mockPostCount,
  mockLongFormFindMany,
  mockLongFormUpdate,
  mockLongFormUpdateMany,
  mockLongFormPostCount,
  mockOutboxDeleteMany,
  mockTransaction,
  mockCancelPostJob,
  mockCancelLongFormPostJob,
  mockCalculateNextScheduleTime,
  mockGetUserTimezone,
  mockCascadeAttachedReschedule,
  mockSchedulePostExecute,
  mockScheduleLongFormExecute,
} = vi.hoisted(() => ({
  mockQueueTypeFindFirst: vi.fn(),
  mockQueueTypeUpdate: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockPostUpdate: vi.fn(),
  mockPostUpdateMany: vi.fn(),
  mockPostCount: vi.fn(),
  mockLongFormFindMany: vi.fn(),
  mockLongFormUpdate: vi.fn(),
  mockLongFormUpdateMany: vi.fn(),
  mockLongFormPostCount: vi.fn(),
  mockOutboxDeleteMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockCancelPostJob: vi.fn(),
  mockCancelLongFormPostJob: vi.fn(),
  mockCalculateNextScheduleTime: vi.fn(),
  mockGetUserTimezone: vi.fn(),
  mockCascadeAttachedReschedule: vi.fn(),
  mockSchedulePostExecute: vi.fn(),
  mockScheduleLongFormExecute: vi.fn(),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    queueType: {
      findFirst: mockQueueTypeFindFirst,
      update: mockQueueTypeUpdate,
    },
    post: {
      findMany: mockPostFindMany,
      update: mockPostUpdate,
      updateMany: mockPostUpdateMany,
      count: mockPostCount,
    },
    longFormPost: {
      findMany: mockLongFormFindMany,
      update: mockLongFormUpdate,
      updateMany: mockLongFormUpdateMany,
      count: mockLongFormPostCount,
    },
    outboxEvent: {
      deleteMany: mockOutboxDeleteMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("~/infra/queue", () => ({
  cancelPostJob: mockCancelPostJob,
  cancelLongFormPostJob: mockCancelLongFormPostJob,
}));

vi.mock("~/features/user", () => ({
  getUserTimezone: mockGetUserTimezone,
}));

vi.mock("~/features/posts/scheduling/services/schedulers", () => ({
  calculateNextScheduleTime: mockCalculateNextScheduleTime,
}));

vi.mock(
  "~/features/posts/scheduling/services/attached-followups.server",
  () => ({
    cascadeAttachedReschedule: mockCascadeAttachedReschedule,
  })
);

vi.mock(
  "~/features/posts/scheduling/use-cases/schedule-post.use-case.server",
  () => ({
    SchedulePostUseCase: class {
      execute = mockSchedulePostExecute;
    },
  })
);

vi.mock(
  "~/features/posts/longform/use-cases/schedule-longform-post.use-case.server",
  () => ({
    ScheduleLongFormPostUseCase: class {
      execute = mockScheduleLongFormExecute;
    },
  })
);

import {
  pauseQueueById,
  resumeQueueById,
} from "~/features/posts/data/queue-pause-resume.server";

/** Matches `CADENCE_MATCH_TOLERANCE_MS` probe in queue-pause-resume.server.ts */
const CADENCE_PROBE_EPSILON_MS = 50;

describe("queue pause/resume service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostCount.mockResolvedValue(0);
    mockLongFormPostCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(
      async (callback: typeof mockTransaction) =>
        callback({
          queueType: { update: mockQueueTypeUpdate },
          post: { update: mockPostUpdate, updateMany: mockPostUpdateMany },
          longFormPost: {
            update: mockLongFormUpdate,
            updateMany: mockLongFormUpdateMany,
          },
          outboxEvent: { deleteMany: mockOutboxDeleteMany },
        })
    );
    mockGetUserTimezone.mockResolvedValue("UTC");
    mockCascadeAttachedReschedule.mockResolvedValue([]);
    mockSchedulePostExecute.mockResolvedValue(undefined);
    mockScheduleLongFormExecute.mockResolvedValue(undefined);
  });

  it("pauses a queue by holding future rows and returning updated status", async () => {
    mockQueueTypeFindFirst.mockResolvedValue({
      id: "queue-1",
      userId: "user-1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
      isEnabled: true,
      status: "ACTIVE",
    });
    mockQueueTypeUpdate.mockResolvedValue({
      id: "queue-1",
      userId: "user-1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
      isEnabled: true,
      status: "PAUSED",
    });
    mockPostFindMany.mockResolvedValue([
      {
        id: "post-1",
        scheduledAtUtc: new Date("2026-04-28T12:00:00Z"),
        nominalScheduledAtUtc: null,
      },
    ]);
    mockLongFormFindMany.mockResolvedValue([
      {
        id: "lf-1",
        scheduledAtUtc: new Date("2026-04-29T12:00:00Z"),
        nominalScheduledAtUtc: null,
      },
    ]);

    const result = await pauseQueueById({
      userId: "user-1",
      queueTypeId: "queue-1",
    });

    expect(mockQueueTypeUpdate).toHaveBeenCalled();
    const pauseHoldFields = {
      queueHoldStatus: "HELD_BY_QUEUE" as const,
      queueHeldByQueueTypeId: "queue-1" as const,
    };
    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-1", userId: "user-1" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        data: expect.objectContaining(pauseHoldFields),
      })
    );
    expect(mockLongFormUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lf-1", userId: "user-1" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        data: expect.objectContaining(pauseHoldFields),
      })
    );
    expect(mockCancelPostJob).toHaveBeenCalledWith("post-1");
    expect(mockCancelLongFormPostJob).toHaveBeenCalledWith("lf-1");
    expect(result).toMatchObject({
      queue: { id: "queue-1", status: "PAUSED" },
      pausedPostCount: 1,
      pausedLongFormCount: 1,
    });
  });

  it("resumes roots forward and marks descendants for re-signing", async () => {
    mockQueueTypeFindFirst.mockResolvedValue({
      id: "queue-1",
      userId: "user-1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
      isEnabled: true,
      status: "PAUSED",
    });
    mockQueueTypeUpdate.mockResolvedValue({
      id: "queue-1",
      userId: "user-1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
      isEnabled: true,
      status: "ACTIVE",
    });
    mockPostFindMany.mockResolvedValue([
      {
        id: "root-1",
        userId: "user-1",
        scheduledAtUtc: new Date("2026-04-20T12:00:00Z"),
        nominalScheduledAtUtc: null,
        queueHeldOriginalScheduledAtUtc: new Date("2026-04-20T12:00:00Z"),
        createdAt: new Date("2026-04-10T12:00:00Z"),
        signedEvent: {
          id: "old-event",
          pubkey: "pk",
          created_at: 100,
          kind: 1,
          tags: [],
          content: "",
          sig: "sig",
        },
        dependencyMode: "standalone",
        parentScheduledActionId: null,
      },
      {
        id: "child-1",
        userId: "user-1",
        scheduledAtUtc: new Date("2026-04-20T13:00:00Z"),
        nominalScheduledAtUtc: null,
        queueHeldOriginalScheduledAtUtc: new Date("2026-04-20T13:00:00Z"),
        createdAt: new Date("2026-04-10T12:05:00Z"),
        signedEvent: null,
        dependencyMode: "attached",
        parentScheduledActionId: "root-1",
      },
    ]);
    mockLongFormFindMany.mockResolvedValue([]);
    mockCalculateNextScheduleTime.mockResolvedValue(
      new Date("2026-05-01T09:00:00Z")
    );
    mockCascadeAttachedReschedule.mockResolvedValue(["child-1"]);
    mockPostCount.mockResolvedValue(2);
    mockLongFormPostCount.mockResolvedValue(0);

    const result = await resumeQueueById({
      userId: "user-1",
      queueTypeId: "queue-1",
    });

    expect(mockSchedulePostExecute).not.toHaveBeenCalled();
    const rootResignFields = {
      queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME" as const,
      scheduledAtUtc: new Date("2026-05-01T09:00:00Z"),
      nostrEventId: null,
    };
    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "root-1", userId: "user-1" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        data: expect.objectContaining(rootResignFields),
      })
    );
    expect(mockCascadeAttachedReschedule).toHaveBeenCalledWith({
      rootPostId: "root-1",
      userId: "user-1",
      parentScheduledAtUtc: new Date("2026-05-01T09:00:00Z"),
    });
    const childResignFields = {
      queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME" as const,
      expectedParentEventId: null,
      signingState: "stale" as const,
    };
    expect(mockPostUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", id: { in: ["child-1"] } },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        data: expect.objectContaining(childResignFields),
      })
    );
    expect(result).toMatchObject({
      queue: { id: "queue-1", status: "ACTIVE" },
      resumedCount: 0,
      needsResignCount: 2,
    });
  });

  it("keeps original scheduled time when still on cadence so signature reuse matches signed event", async () => {
    const slot = new Date("2026-06-10T14:00:00.000Z");
    mockQueueTypeFindFirst.mockResolvedValue({
      id: "queue-1",
      userId: "user-1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
      isEnabled: true,
      status: "PAUSED",
    });
    mockQueueTypeUpdate.mockResolvedValue({
      id: "queue-1",
      userId: "user-1",
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 6 },
      isEnabled: true,
      status: "ACTIVE",
    });
    mockPostFindMany.mockResolvedValue([
      {
        id: "root-preserve",
        userId: "user-1",
        scheduledAtUtc: slot,
        nominalScheduledAtUtc: null,
        queueHeldOriginalScheduledAtUtc: slot,
        createdAt: new Date("2026-05-01T12:00:00Z"),
        signedEvent: {
          id: "evt",
          pubkey: "pk",
          created_at: 100,
          kind: 1,
          tags: [],
          content: "",
          sig: "sig",
        },
        dependencyMode: "standalone",
        parentScheduledActionId: null,
      },
    ]);
    mockLongFormFindMany.mockResolvedValue([]);
    mockCalculateNextScheduleTime.mockImplementation(
      async ({ baseTime }: { baseTime?: Date }) => {
        const probeMs = slot.getTime() - 2000;
        if (
          baseTime &&
          Math.abs(baseTime.getTime() - probeMs) <= CADENCE_PROBE_EPSILON_MS
        ) {
          return slot;
        }
        return new Date("2099-01-01T00:00:00Z");
      }
    );

    const result = await resumeQueueById({
      userId: "user-1",
      queueTypeId: "queue-1",
    });

    expect(mockSchedulePostExecute).toHaveBeenCalledTimes(1);
    expect(mockSchedulePostExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: "root-preserve",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        signedEvent: expect.objectContaining({ id: "evt" }),
      })
    );
    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "root-preserve", userId: "user-1" },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        data: expect.objectContaining({
          queueHoldStatus: "NONE",
          queueHeldOriginalScheduledAtUtc: null,
        }),
      })
    );
    expect(mockPostUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        data: expect.objectContaining({
          queueHoldStatus: "NEEDS_RESIGN_AFTER_QUEUE_RESUME",
        }),
      })
    );
    expect(result).toMatchObject({
      queue: { id: "queue-1", status: "ACTIVE" },
      resumedCount: 1,
      needsResignCount: 0,
    });
  });
});
