/**
 * Integration tests for template model
 * Tests app/models/template.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    template: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "~/lib/prisma.server";
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  removePostFromTemplate,
} from "~/models/template.server";

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

describe("Template Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("should create a template with posts", async () => {
      const mockTemplate = {
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Test Template",
        posts: [{ id: TEST_POST_ID }],
      };
      (prisma.template.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await createTemplate({
        userId: TEST_USER_ID,
        name: "Test Template",
        postIds: [TEST_POST_ID],
      });

      expect(prisma.template.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          name: "Test Template",
          posts: {
            connect: [{ id: TEST_POST_ID }],
          },
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should create a template with multiple posts", async () => {
      const mockTemplate = {
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Test Template",
        posts: [{ id: "post-1" }, { id: "post-2" }],
      };
      (prisma.template.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await createTemplate({
        userId: TEST_USER_ID,
        name: "Test Template",
        postIds: ["post-1", "post-2"],
      });

      expect(prisma.template.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          name: "Test Template",
          posts: {
            connect: [{ id: "post-1" }, { id: "post-2" }],
          },
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should create a template with no posts", async () => {
      const mockTemplate = {
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Test Template",
        posts: [],
      };
      (prisma.template.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await createTemplate({
        userId: TEST_USER_ID,
        name: "Test Template",
        postIds: [],
      });

      expect(prisma.template.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          name: "Test Template",
          posts: {
            connect: [],
          },
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe("getTemplates", () => {
    it("should get all templates for a user", async () => {
      const mockTemplates = [
        { id: "template-1", userId: TEST_USER_ID, name: "Template 1" },
        { id: "template-2", userId: TEST_USER_ID, name: "Template 2" },
      ];
      (prisma.template.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplates,
      );

      const result = await getTemplates({ userId: TEST_USER_ID });

      expect(prisma.template.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        include: {
          posts: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      expect(result).toEqual(mockTemplates);
    });
  });

  describe("getTemplateById", () => {
    it("should get a template by ID", async () => {
      const mockTemplate = {
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Test Template",
        posts: [],
      };
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await getTemplateById({
        id: "template-123",
        userId: TEST_USER_ID,
      });

      expect(prisma.template.findFirst).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should return null if template not found", async () => {
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await getTemplateById({
        id: "nonexistent",
        userId: TEST_USER_ID,
      });

      expect(result).toBeNull();
    });
  });

  describe("updateTemplate", () => {
    it("should update template name", async () => {
      const mockTemplate = {
        id: "template-123",
        name: "Updated Template",
        posts: [],
      };
      (prisma.template.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await updateTemplate({
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Updated Template",
      });

      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        data: {
          name: "Updated Template",
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should update template posts", async () => {
      const mockTemplate = {
        id: "template-123",
        name: "Test Template",
        posts: [{ id: "post-1" }, { id: "post-2" }],
      };
      (prisma.template.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await updateTemplate({
        id: "template-123",
        userId: TEST_USER_ID,
        postIds: ["post-1", "post-2"],
      });

      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        data: {
          posts: {
            set: [{ id: "post-1" }, { id: "post-2" }],
          },
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should update both name and posts", async () => {
      const mockTemplate = {
        id: "template-123",
        name: "Updated Template",
        posts: [{ id: "post-1" }],
      };
      (prisma.template.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await updateTemplate({
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Updated Template",
        postIds: ["post-1"],
      });

      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        data: {
          name: "Updated Template",
          posts: {
            set: [{ id: "post-1" }],
          },
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe("deleteTemplate", () => {
    it("should delete a template", async () => {
      const mockTemplate = { id: "template-123", userId: TEST_USER_ID };
      (prisma.template.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await deleteTemplate({
        id: "template-123",
        userId: TEST_USER_ID,
      });

      expect(prisma.template.delete).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe("removePostFromTemplate", () => {
    it("should remove a post from template", async () => {
      const mockTemplate = {
        id: "template-123",
        userId: TEST_USER_ID,
        posts: [],
      };
      (prisma.template.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate,
      );

      const result = await removePostFromTemplate({
        templateId: "template-123",
        postId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        data: {
          posts: {
            disconnect: { id: TEST_POST_ID },
          },
        },
        include: {
          posts: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });
  });
});




