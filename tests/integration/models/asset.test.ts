/**
 * Integration tests for asset model
 * Tests app/models/asset.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    asset: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import { prisma } from "~/lib/prisma.server";
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  getAssetsByType,
  searchAssets,
} from "~/models/asset.server";

describe("Asset Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAsset", () => {
    it("should create an asset with all fields", async () => {
      const mockAsset = {
        id: "asset-123",
        userId: TEST_USER_ID,
        title: "Test Asset",
        content: "Test content",
        fileUrl: "https://example.com/file.jpg",
        tags: ["tag1", "tag2"],
        assetType: "IMAGE" as const,
      };
      (prisma.asset.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAsset
      );

      const result = await createAsset({
        userId: TEST_USER_ID,
        title: "Test Asset",
        content: "Test content",
        fileUrl: "https://example.com/file.jpg",
        tags: ["tag1", "tag2"],
        assetType: "IMAGE",
      });

      expect(prisma.asset.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          title: "Test Asset",
          content: "Test content",
          fileUrl: "https://example.com/file.jpg",
          tags: ["tag1", "tag2"],
          assetType: "IMAGE",
        },
      });
      expect(result).toEqual(mockAsset);
    });

    it("should create an asset with minimal fields", async () => {
      const mockAsset = {
        id: "asset-123",
        userId: TEST_USER_ID,
        assetType: "VIDEO" as const,
        tags: [],
      };
      (prisma.asset.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAsset
      );

      const result = await createAsset({
        userId: TEST_USER_ID,
        assetType: "VIDEO",
      });

      expect(prisma.asset.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          title: undefined,
          content: undefined,
          fileUrl: undefined,
          tags: [],
          assetType: "VIDEO",
        },
      });
      expect(result).toEqual(mockAsset);
    });
  });

  describe("getAssets", () => {
    it("should get assets with pagination", async () => {
      const mockAssets = [
        { id: "asset-1", userId: TEST_USER_ID },
        { id: "asset-2", userId: TEST_USER_ID },
      ];
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAssets
      );
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const result = await getAssets({
        userId: TEST_USER_ID,
        page: 1,
        limit: 10,
      });

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result.assets).toEqual(mockAssets);
      expect(result.totalCount).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
    });

    it("should calculate pagination correctly", async () => {
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const result = await getAssets({
        userId: TEST_USER_ID,
        page: 2,
        limit: 10,
      });

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 10,
      });
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(2);
    });

    it("should use default pagination values", async () => {
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await getAssets({
        userId: TEST_USER_ID,
      });

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 100,
      });
    });
  });

  describe("getAssetById", () => {
    it("should get asset by ID", async () => {
      const mockAsset = { id: "asset-123", userId: TEST_USER_ID };
      (prisma.asset.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAsset
      );

      const result = await getAssetById({
        id: "asset-123",
        userId: TEST_USER_ID,
      });

      expect(prisma.asset.findFirst).toHaveBeenCalledWith({
        where: { id: "asset-123", userId: TEST_USER_ID },
      });
      expect(result).toEqual(mockAsset);
    });
  });

  describe("updateAsset", () => {
    it("should update asset with all fields", async () => {
      const mockAsset = {
        id: "asset-123",
        title: "Updated Title",
        content: "Updated content",
        fileUrl: "https://example.com/new.jpg",
        tags: ["tag3"],
      };
      (prisma.asset.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAsset
      );

      const result = await updateAsset({
        id: "asset-123",
        userId: TEST_USER_ID,
        title: "Updated Title",
        content: "Updated content",
        fileUrl: "https://example.com/new.jpg",
        tags: ["tag3"],
      });

      expect(prisma.asset.update).toHaveBeenCalledWith({
        where: { id: "asset-123", userId: TEST_USER_ID },
        data: {
          title: "Updated Title",
          content: "Updated content",
          fileUrl: "https://example.com/new.jpg",
          tags: ["tag3"],
        },
      });
      expect(result).toEqual(mockAsset);
    });

    it("should update asset with partial fields", async () => {
      const mockAsset = { id: "asset-123", title: "Updated Title" };
      (prisma.asset.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAsset
      );

      const result = await updateAsset({
        id: "asset-123",
        userId: TEST_USER_ID,
        title: "Updated Title",
      });

      expect(prisma.asset.update).toHaveBeenCalledWith({
        where: { id: "asset-123", userId: TEST_USER_ID },
        data: {
          title: "Updated Title",
        },
      });
      expect(result).toEqual(mockAsset);
    });
  });

  describe("deleteAsset", () => {
    it("should delete an asset", async () => {
      const mockAsset = { id: "asset-123", userId: TEST_USER_ID };
      (prisma.asset.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAsset
      );

      const result = await deleteAsset({
        id: "asset-123",
        userId: TEST_USER_ID,
      });

      expect(prisma.asset.delete).toHaveBeenCalledWith({
        where: { id: "asset-123", userId: TEST_USER_ID },
      });
      expect(result).toEqual(mockAsset);
    });
  });

  describe("getAssetsByType", () => {
    it("should get assets by type", async () => {
      const mockAssets = [
        { id: "asset-1", assetType: "IMAGE" },
        { id: "asset-2", assetType: "IMAGE" },
      ];
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAssets
      );

      const result = await getAssetsByType({
        userId: TEST_USER_ID,
        assetType: "IMAGE",
      });

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, assetType: "IMAGE" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockAssets);
    });
  });

  describe("searchAssets", () => {
    it("should search assets by title", async () => {
      const mockAssets = [{ id: "asset-1", title: "Test Asset" }];
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAssets
      );
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await searchAssets({
        userId: TEST_USER_ID,
        searchTerm: "Test",
        page: 1,
        limit: 10,
      });

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          OR: [
            {
              title: {
                contains: "Test",
                mode: "insensitive",
              },
            },
            {
              content: {
                contains: "Test",
                mode: "insensitive",
              },
            },
            {
              tags: {
                hasSome: ["test"],
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result.assets).toEqual(mockAssets);
      expect(result.totalCount).toBe(1);
    });

    it("should handle multi-word search terms", async () => {
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await searchAssets({
        userId: TEST_USER_ID,
        searchTerm: "test search term",
        page: 1,
        limit: 10,
      });

      const callArgs = (prisma.asset.findMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as
        | { where?: { OR?: Array<{ tags?: { hasSome?: string[] } }> } }
        | undefined;
      expect(callArgs?.where?.OR).toBeDefined();
      const tagsCondition = callArgs?.where?.OR?.find(
        (condition) =>
          typeof condition === "object" &&
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: type guard for mock Prisma query (types have no overlap due to Prisma's complex types)
          condition !== null &&
          "tags" in condition
      );
      expect(tagsCondition?.tags?.hasSome).toEqual(["test", "search", "term"]);
    });

    it("should use default pagination", async () => {
      (prisma.asset.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.asset.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await searchAssets({
        userId: TEST_USER_ID,
        searchTerm: "test",
      });

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
        where: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 100,
      });
    });
  });
});
