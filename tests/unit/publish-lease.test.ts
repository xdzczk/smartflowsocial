import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    post: {
      updateMany: vi.fn(),
    },
    longFormPost: {
      updateMany: vi.fn(),
    },
  },
}));

import {
  acquireLongFormPostPublishLease,
  acquirePostPublishLease,
  releaseLongFormPostPublishLease,
  releasePostPublishLease,
} from "~/infra/publishing/publish-lease.server";
import { prisma } from "~/lib/prisma.server";

describe("publish-lease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acquirePostPublishLease returns a lease when update succeeds", async () => {
    (prisma.post.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    });

    const lease = await acquirePostPublishLease({
      postId: "post-1",
      userId: "user-1",
      ttlMs: 1000,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(lease).not.toBeNull();
    expect(typeof lease?.lockId).toBe("string");
    expect(lease?.expiresAt.toISOString()).toBe("2026-01-01T00:00:01.000Z");
  });

  it("acquirePostPublishLease returns null when update fails", async () => {
    (prisma.post.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });

    const lease = await acquirePostPublishLease({
      postId: "post-1",
      userId: "user-1",
    });

    expect(lease).toBeNull();
  });

  it("releasePostPublishLease calls updateMany with lockId guard", async () => {
    (prisma.post.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    });

    await releasePostPublishLease({
      postId: "post-1",
      userId: "user-1",
      lockId: "lock-1",
    });

    expect(prisma.post.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        where: expect.objectContaining({
          id: "post-1",
          userId: "user-1",
          publishingLockId: "lock-1",
        }),
      })
    );
  });

  it("acquireLongFormPostPublishLease returns null when update fails", async () => {
    (
      prisma.longFormPost.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 0 });

    const lease = await acquireLongFormPostPublishLease({
      postId: "lf-1",
      userId: "user-1",
    });

    expect(lease).toBeNull();
  });

  it("releaseLongFormPostPublishLease calls updateMany with lockId guard", async () => {
    (
      prisma.longFormPost.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 1 });

    await releaseLongFormPostPublishLease({
      postId: "lf-1",
      userId: "user-1",
      lockId: "lock-1",
    });

    expect(prisma.longFormPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        where: expect.objectContaining({
          id: "lf-1",
          userId: "user-1",
          publishingLockId: "lock-1",
        }),
      })
    );
  });
});
