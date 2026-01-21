import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    publishRelayAck: {
      deleteMany: vi.fn(),
    },
  },
}));

import { cleanupPublishRelayAcks } from "~/features/relays/publish-relay-ack-retention.server";
import { prisma } from "~/lib/prisma.server";

describe("PublishRelayAck retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete rows older than 30 days by default", async () => {
    (
      prisma.publishRelayAck.deleteMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 123 });

    const result = await cleanupPublishRelayAcks();

    expect(prisma.publishRelayAck.deleteMany).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(123);
    expect(typeof result.cutoffIso).toBe("string");
  });
});
