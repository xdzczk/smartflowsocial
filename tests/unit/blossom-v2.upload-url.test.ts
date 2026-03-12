import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    BLOSSOM_UPLOAD_TOKEN_SECRET: "test-upload-secret",
    BLOSSOM_INTERNAL_SECRET: undefined as string | undefined,
    BLOSSOM_SFS_API_URL: undefined as string | undefined,
  },
}));

vi.mock("~/lib/env.server", () => ({
  env: mockEnv,
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

vi.mock("~/features/payments/data", () => ({
  getUserSubscription: vi.fn(),
}));

vi.mock("~/features/upload/services/media.server", () => ({
  getCanonicalOwnedBytesForUser: vi.fn(),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    blossomReservationItem: {
      aggregate: vi.fn(),
    },
    blossomUploadUsagePeriod: {
      findUnique: vi.fn(),
    },
    blossomReservationBatch: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getUserSubscription } from "~/features/payments/data";
import { issueBlossomBulkTokens } from "~/features/upload/services/blossom-v2.server";
import { getCanonicalOwnedBytesForUser } from "~/features/upload/services/media.server";
import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";

describe("issueBlossomBulkTokens uploadUrl normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
      npub: "npub1test",
    });
    (getUserSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (
      getCanonicalOwnedBytesForUser as ReturnType<typeof vi.fn>
    ).mockResolvedValue(BigInt(0));
    (
      prisma.blossomReservationItem.aggregate as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      _sum: { size: 0 },
    });
    (
      prisma.blossomUploadUsagePeriod.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
  });

  it("returns single /upload when BLOSSOM_SFS_API_URL is API root", async () => {
    mockEnv.BLOSSOM_SFS_API_URL = "https://blossom-api.smartflow.social";
    const result = await issueBlossomBulkTokens("user-1", [
      { sha256: "not-a-valid-sha", size: 123, type: "image/jpeg" },
    ]);
    expect(result.uploadUrl).toBe(
      "https://blossom-api.smartflow.social/upload"
    );
  });

  it("returns single /upload when BLOSSOM_SFS_API_URL already ends with /upload", async () => {
    mockEnv.BLOSSOM_SFS_API_URL = "https://blossom-api.smartflow.social/upload";
    const result = await issueBlossomBulkTokens("user-1", [
      { sha256: "not-a-valid-sha", size: 123, type: "image/jpeg" },
    ]);
    expect(result.uploadUrl).toBe(
      "https://blossom-api.smartflow.social/upload"
    );
  });

  it("returns single /upload when BLOSSOM_SFS_API_URL ends with /upload/", async () => {
    mockEnv.BLOSSOM_SFS_API_URL =
      "https://blossom-api.smartflow.social/upload/";
    const result = await issueBlossomBulkTokens("user-1", [
      { sha256: "not-a-valid-sha", size: 123, type: "image/jpeg" },
    ]);
    expect(result.uploadUrl).toBe(
      "https://blossom-api.smartflow.social/upload"
    );
  });
});
