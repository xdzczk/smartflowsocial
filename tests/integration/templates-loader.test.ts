/**
 * Integration tests for templates loader
 *
 * Tests the loader in app/features/templates/services/templates-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/models/template.server", () => ({
  getTemplates: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

import { TEST_USER_ID } from "../utils/test-helpers";

import { loadTemplatesData } from "~/features/templates/services/templates-loader.server";
import { getUserById } from "~/features/user";
import { getTemplates } from "~/models/template.server";

describe("Templates Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Data Loading", () => {
    it("should load templates data", async () => {
      const mockTemplates = [
        { id: "template-1", name: "Template 1" },
        { id: "template-2", name: "Template 2" },
      ];

      const mockUser = {
        id: TEST_USER_ID,
        name: "Test User",
      };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplates
      );
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadTemplatesData(TEST_USER_ID);

      expect(getTemplates).toHaveBeenCalledWith({ userId: TEST_USER_ID });
      expect(getUserById).toHaveBeenCalledWith(TEST_USER_ID);
      expect(result).toEqual({
        templates: mockTemplates,
        user: mockUser,
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty templates", async () => {
      const mockUser = { id: TEST_USER_ID };

      (getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await loadTemplatesData(TEST_USER_ID);

      expect(result.templates).toEqual([]);
      expect(result.user).toEqual(mockUser);
    });
  });
});
