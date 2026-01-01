/**
 * Integration tests for templates loader
 * 
 * Tests the loader in app/features/templates/services/templates-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/models/asset.server", () => ({
  getAssets: vi.fn(),
  searchAssets: vi.fn(),
}));

vi.mock("~/models/template.server", () => ({
  getTemplates: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

import { loadTemplatesData } from "~/features/templates/services/templates-loader.server";
import { getAssets, searchAssets } from "~/models/asset.server";
import { getTemplates } from "~/models/template.server";
import { getUserById } from "~/features/user";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("Templates Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Data Loading", () => {
    it("should load templates data without search term", async () => {
      const mockTemplates = [
        { id: "template-1", name: "Template 1" },
        { id: "template-2", name: "Template 2" },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        name: "Test User",
      };

      const mockAssetsData = {
        assets: [
          { id: "asset-1", name: "Asset 1" },
          { id: "asset-2", name: "Asset 2" },
        ],
        totalCount: 2,
        totalPages: 1,
        currentPage: 1,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      const _result = await loadTemplatesData(TEST_USER_ID, "", 1, 100);

      expect(getTemplates).toHaveBeenCalledWith({ userId: TEST_USER_ID });
      expect(getUserById).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getAssets).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        page: 1,
        limit: 100,
      });
      expect(_result).toEqual({
        templates: mockTemplates,
        user: mockUser,
        assets: mockAssetsData.assets,
        totalCount: mockAssetsData.totalCount,
        totalPages: mockAssetsData.totalPages,
        currentPage: mockAssetsData.currentPage,
        searchTerm: "",
      });
    });

    it("should load templates data with search term", async () => {
      const mockTemplates = [
        { id: "template-1", name: "Template 1" },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        name: "Test User",
      };

      const mockAssetsData = {
        assets: [
          { id: "asset-1", name: "Searched Asset" },
        ],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (searchAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      const _result = await loadTemplatesData(TEST_USER_ID, "search", 1, 100);

      expect(searchAssets).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        searchTerm: "search",
        page: 1,
        limit: 100,
      });
      expect(_result.searchTerm).toBe("search");
    });

    it("should handle pagination correctly", async () => {
      const mockTemplates: unknown[] = [];
      const mockUser = { id: TEST_USER_ID };
      const mockAssetsData = {
        assets: [],
        totalCount: 50,
        totalPages: 5,
        currentPage: 2,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      const _result = await loadTemplatesData(TEST_USER_ID, "", 2, 10);

      expect(getAssets).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        page: 2,
        limit: 10,
      });
      expect(_result.currentPage).toBe(2);
      expect(_result.totalPages).toBe(5);
      expect(_result.totalCount).toBe(50);
    });

    it("should handle custom limit", async () => {
      const mockTemplates: unknown[] = [];
      const mockUser = { id: TEST_USER_ID };
      const mockAssetsData = {
        assets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      await loadTemplatesData(TEST_USER_ID, "", 1, 50);

      expect(getAssets).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        page: 1,
        limit: 50,
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty templates", async () => {
      const mockUser = { id: TEST_USER_ID };
      const mockAssetsData = {
        assets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      const result = await loadTemplatesData(TEST_USER_ID, "", 1, 100);

      expect(result.templates).toEqual([]);
      expect(result.assets).toEqual([]);
    });

    it("should handle empty assets", async () => {
      const mockTemplates = [
        { id: "template-1", name: "Template 1" },
      ];
      const mockUser = { id: TEST_USER_ID };
      const mockAssetsData = {
        assets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      const result = await loadTemplatesData(TEST_USER_ID, "", 1, 100);

      expect(result.templates).toHaveLength(1);
      expect(result.assets).toEqual([]);
    });

    it("should use default parameters when not provided", async () => {
      const mockTemplates: unknown[] = [];
      const mockUser = { id: TEST_USER_ID };
      const mockAssetsData = {
        assets: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (getAssets as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetsData);

      const result = await loadTemplatesData(TEST_USER_ID);

      expect(result.searchTerm).toBe("");
      expect(result.currentPage).toBe(1);
    });
  });
});







