import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindPostUnique,
  mockFindLongFormPostUnique,
  mockRecordJobSkipped,
  mockPostFindMany,
  mockLongFormFindMany,
} = vi.hoisted(() => ({
  mockFindPostUnique: vi.fn(),
  mockFindLongFormPostUnique: vi.fn(),
  mockRecordJobSkipped: vi.fn(),
  mockPostFindMany: vi.fn(),
  mockLongFormFindMany: vi.fn(),
}));

vi.mock("~/features/posts/repositories/post-queries-data.server", () => ({
  findPostUnique: mockFindPostUnique,
}));

vi.mock("~/features/posts/repositories/longform-data.server", () => ({
  findLongFormPostUnique: mockFindLongFormPostUnique,
}));

vi.mock("~/features/posts/queue-handlers/shared.server", () => ({
  QUEUE_SCHEDULED_POSTS: "scheduled-posts",
  QUEUE_SCHEDULED_LONGFORM_POSTS: "scheduled-longform-posts",
  getSanitizedUserRelays: vi.fn(),
  publishWithQueueSpan: vi.fn(),
  computeWillRetry: vi.fn(),
}));

vi.mock("~/infra/publishing/publish-lease.server", () => ({
  acquirePostPublishLease: vi.fn(),
  releasePostPublishLease: vi.fn(),
  acquireLongFormPostPublishLease: vi.fn(),
  releaseLongFormPostPublishLease: vi.fn(),
}));

vi.mock("~/features/posts/queue-payload.server", () => ({
  toSignedEvent: vi.fn((x) => x),
  computeScheduledForUnix: vi.fn(() => 1),
  delayMs: vi.fn(async () => undefined),
}));

vi.mock("~/features/posts/state-machine/post-state-machine.server", () => ({
  PostStateMachine: class {
    transition = vi.fn(async () => undefined);
  },
}));

vi.mock("~/features/posts/longform/index.server", () => ({
  LongFormPostStateMachine: class {
    transition = vi.fn(async () => undefined);
  },
}));

vi.mock("~/lib/queue-metrics.server", () => ({
  recordJobMetrics: vi.fn(),
  recordJobSkipped: mockRecordJobSkipped,
  recordJobRetry: vi.fn(),
}));

vi.mock("~/lib/error-logger.server", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("~/lib/validation/nostr-cryptographic.server", () => ({
  validateSignedEventCryptographically: vi.fn((x) => x),
}));

vi.mock("~/features/posts/stats.server", () => ({
  getPostStats: vi.fn(),
}));

vi.mock("~/features/relays/publish-relay-acks.server", () => ({
  persistPublishRelayAcks: vi.fn(),
}));

vi.mock("~/infra/queue/dead-letter-queue.server", () => ({
  createDeadLetterEntry: vi.fn(),
}));

vi.mock("~/lib/sentry.server", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("~/lib/metrics/business-metrics.server", () => ({
  recordPostPublished: vi.fn(),
  recordPostPublishFailed: vi.fn(),
}));

vi.mock("~/lib/metrics/performance-metrics.server", () => ({
  recordPublishLatency: vi.fn(),
  recordPublishLateness: vi.fn(),
}));

vi.mock("~/lib/idempotency.server", () => ({
  generatePublishAttemptId: vi.fn(() => "attempt-1"),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    post: { findMany: mockPostFindMany },
    longFormPost: { findMany: mockLongFormFindMany },
  },
}));

import { getCronDueScheduledLongFormPosts } from "~/features/posts/data/longformpost.queries.server";
import { getCronDueScheduledPosts } from "~/features/posts/data/post.queries.cron.server";
import { runScheduledLongFormPostJob } from "~/features/posts/queue-handlers/longform-job.server";
import { runScheduledPostJob } from "~/features/posts/queue-handlers/post-job.server";
import type { LongFormPostJobData, PostJobData } from "~/infra/queue";

describe("queue worker guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips shortform jobs for paused queues", async () => {
    mockFindPostUnique.mockResolvedValueOnce({
      scheduledAtUtc: new Date(),
      currentState: "SCHEDULED",
      queueHoldStatus: "NONE",
      queueType: { status: "PAUSED", isEnabled: true, name: "Main" },
    });

    const shortSigned: PostJobData["signedEvent"] = {
      id: "event-1",
      pubkey: "pk",
      created_at: 1,
      kind: 1,
      tags: [],
      content: "",
      sig: "sig",
    };
    const shortJobData: PostJobData = {
      postId: "post-1",
      userId: "user-1",
      signedEvent: shortSigned,
      correlationId: "corr-1",
    };
    const shortFormWorkerInput: Parameters<typeof runScheduledPostJob>[0] = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial BullMQ Job stub for guard tests
      job: {
        id: "job-1",
        attemptsMade: 0,
        data: shortJobData,
      } as Job<PostJobData>,
      startTime: Date.now(),
      ctx: { lease: null },
    };

    const result = await runScheduledPostJob(shortFormWorkerInput);

    expect(result).toEqual({ success: true, postId: "post-1", skipped: true });
    expect(mockRecordJobSkipped).toHaveBeenCalledWith(
      "scheduled-posts",
      "queue_paused"
    );
  });

  it("skips longform jobs for held rows", async () => {
    mockFindLongFormPostUnique.mockResolvedValueOnce({
      scheduledAtUtc: new Date(),
      currentState: "SCHEDULED",
      queueHoldStatus: "HELD_BY_QUEUE",
      queueType: { status: "ACTIVE", isEnabled: true, name: "Main" },
    });

    const longSigned: LongFormPostJobData["signedEvent"] = {
      id: "event-2",
      pubkey: "pk",
      created_at: 1,
      kind: 30023,
      tags: [],
      content: "",
      sig: "sig",
    };
    const longJobData: LongFormPostJobData = {
      postId: "lf-1",
      userId: "user-1",
      signedEvent: longSigned,
      correlationId: "corr-2",
    };
    const longFormWorkerInput: Parameters<
      typeof runScheduledLongFormPostJob
    >[0] = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial BullMQ Job stub for guard tests
      job: {
        id: "job-2",
        attemptsMade: 0,
        data: longJobData,
      } as Job<LongFormPostJobData>,
      startTime: Date.now(),
      ctx: { lease: null },
    };

    const result = await runScheduledLongFormPostJob(longFormWorkerInput);

    expect(result).toEqual({ success: true, postId: "lf-1", skipped: true });
    expect(mockRecordJobSkipped).toHaveBeenCalledWith(
      "scheduled-longform-posts",
      "queue_held"
    );
  });

  it("excludes held and paused rows from cron due queries", async () => {
    mockPostFindMany.mockResolvedValue([]);
    mockLongFormFindMany.mockResolvedValue([]);

    await getCronDueScheduledPosts();
    await getCronDueScheduledLongFormPosts();

    const cronDueWhere = {
      currentState: "SCHEDULED" as const,
      queueHoldStatus: "NONE" as const,
      OR: [
        { queueTypeId: null },
        { queueType: { status: { not: "PAUSED" as const } } },
      ],
    };
    expect(mockPostFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        where: expect.objectContaining(cronDueWhere),
      })
    );
    expect(mockLongFormFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
        where: expect.objectContaining(cronDueWhere),
      })
    );
  });
});
