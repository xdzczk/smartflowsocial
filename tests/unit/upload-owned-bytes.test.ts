import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    media: {
      aggregate: vi.fn(),
    },
  },
}));

import { getCanonicalOwnedBytesForUser } from "~/features/upload/services/media.server";
import { prisma } from "~/lib/prisma.server";

describe("getCanonicalOwnedBytesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries canonical owned storage providers only", async () => {
    (prisma.media.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { size: 1234 },
    });
    const result = await getCanonicalOwnedBytesForUser("user-1");
    expect(result).toBe(BigInt(1234));
    expect(prisma.media.aggregate).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [{ provider: "S3" }, { provider: { startsWith: "BLOSSOM" } }],
      },
      _sum: { size: true },
    });
  });

  it("returns zero when aggregate has no size", async () => {
    (prisma.media.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { size: null },
    });
    const result = await getCanonicalOwnedBytesForUser("user-2");
    expect(result).toBe(BigInt(0));
  });
});
