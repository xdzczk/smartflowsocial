import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindPostUnique,
  mockAcquireLease,
  mockReleaseLease,
  mockRecordJobSkipped,
} = vi.hoisted(() => ({
  mockFindPostUnique: vi.fn(),
  mockAcquireLease: vi.fn(),
  mockReleaseLease: vi.fn(),
  mockRecordJobSkipped: vi.fn(),
}));

vi.mock("~/features/posts/repositories/post-queries-data.server", () => ({
  findPostUnique: mockFindPostUnique,
}));

vi.mock("~/infra/publishing/publish-lease.server", () => ({
  acquirePostPublishLease: mockAcquireLease,
  releasePostPublishLease: mockReleaseLease,
}));

vi.mock("~/features/posts/queue-handlers/shared.server", () => ({
  QUEUE_SCHEDULED_POSTS: "scheduled-posts",
  getSanitizedUserRelays: vi.fn(),
  publishWithQueueSpan: vi.fn(),
  computeWillRetry: vi.fn(),
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

import { runScheduledPostJob } from "~/features/posts/queue-handlers/post-job.server";

describe("runScheduledPostJob attached guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAcquireLease.mockResolvedValue({ lockId: "lease-1" });
  });

  it("skips publish when attached child signingState is not signed", async () => {
    mockFindPostUnique
      .mockResolvedValueOnce({
        scheduledAtUtc: new Date(),
        currentState: "SCHEDULED",
      })
      .mockResolvedValueOnce({
        postKind: "QUOTE",
        repostOfPostId: null,
        repostConditions: null,
        dependencyMode: "attached",
        signingState: "stale",
        parentScheduledActionId: "parent-1",
        expectedParentEventId: "parent-event",
        currentState: "SCHEDULED",
      });

    const result = await runScheduledPostJob({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test only stubs the job shape consumed by this unit path
      job: {
        id: "job-1",
        attemptsMade: 0,
        data: {
          postId: "child-1",
          userId: "user-1",
          signedEvent: {
            id: "child-event",
            pubkey: "pk",
            created_at: 1,
            kind: 1,
            tags: [],
            content: "",
            sig: "sig",
          },
          correlationId: "corr-1",
        },
      } as never,
      startTime: Date.now(),
      ctx: { lease: null },
    });

    expect(result).toEqual({ success: true, postId: "child-1", skipped: true });
    expect(mockReleaseLease).toHaveBeenCalledWith({
      postId: "child-1",
      userId: "user-1",
      lockId: "lease-1",
    });
    expect(mockRecordJobSkipped).toHaveBeenCalledWith(
      "scheduled-posts",
      "attached_dependency_invalid"
    );
  });
});
