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

import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { prisma } from "~/lib/prisma.server";
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  getTemplatePrefill,
} from "~/models/template.server";

describe("Template Model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("should create a POST template with postId", async () => {
      const mockTemplate = {
        id: "template-123",
        userId: TEST_USER_ID,
        name: "Test Template",
        templateType: "POST",
        postId: TEST_POST_ID,
        longFormPostId: null,
        post: { id: TEST_POST_ID },
        longFormPost: null,
      };
      (prisma.template.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const result = await createTemplate({
        userId: TEST_USER_ID,
        name: "Test Template",
        templateType: "POST",
        postId: TEST_POST_ID,
        longFormPostId: null,
      });

      expect(prisma.template.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          name: "Test Template",
          templateType: "POST",
          post: { connect: { id: TEST_POST_ID } },
        },
        include: {
          post: true,
          longFormPost: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should create a LONGFORM template with longFormPostId", async () => {
      const mockTemplate = {
        id: "template-456",
        userId: TEST_USER_ID,
        name: "Longform Template",
        templateType: "LONGFORM",
        postId: null,
        longFormPostId: "lf-1",
        post: null,
        longFormPost: { id: "lf-1" },
      };
      (prisma.template.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const result = await createTemplate({
        userId: TEST_USER_ID,
        name: "Longform Template",
        templateType: "LONGFORM",
        postId: null,
        longFormPostId: "lf-1",
      });

      expect(prisma.template.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          name: "Longform Template",
          templateType: "LONGFORM",
          longFormPost: { connect: { id: "lf-1" } },
        },
        include: {
          post: true,
          longFormPost: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe("getTemplates", () => {
    it("should get all templates for a user", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          userId: TEST_USER_ID,
          name: "Template 1",
          post: null,
          longFormPost: null,
        },
        {
          id: "template-2",
          userId: TEST_USER_ID,
          name: "Template 2",
          post: null,
          longFormPost: null,
        },
      ];
      (prisma.template.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplates
      );

      const result = await getTemplates({ userId: TEST_USER_ID });

      expect(prisma.template.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        include: {
          post: true,
          longFormPost: true,
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
        post: null,
        longFormPost: null,
      };
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const result = await getTemplateById({
        id: "template-123",
        userId: TEST_USER_ID,
      });

      expect(prisma.template.findFirst).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        include: {
          post: true,
          longFormPost: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should return null if template not found", async () => {
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
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
        post: null,
        longFormPost: null,
      };
      (prisma.template.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
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
          post: true,
          longFormPost: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it("should update template postId", async () => {
      const mockTemplate = {
        id: "template-123",
        name: "Test Template",
        post: { id: TEST_POST_ID },
        longFormPost: null,
      };
      (prisma.template.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
      );

      const result = await updateTemplate({
        id: "template-123",
        userId: TEST_USER_ID,
        postId: TEST_POST_ID,
      });

      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: "template-123", userId: TEST_USER_ID },
        data: {
          post: { connect: { id: TEST_POST_ID } },
        },
        include: {
          post: true,
          longFormPost: true,
        },
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe("deleteTemplate", () => {
    it("should delete a template", async () => {
      const mockTemplate = { id: "template-123", userId: TEST_USER_ID };
      (prisma.template.delete as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTemplate
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

  describe("getTemplatePrefill", () => {
    it("should return null if template not found", async () => {
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await getTemplatePrefill({
        id: "nonexistent",
        userId: TEST_USER_ID,
      });

      expect(result).toBeNull();
    });

    it("should return POST prefill when template has post", async () => {
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: "t-1",
          templateType: "POST",
          post: {
            content: "Hello",
            caption: "Hello",
            fileUrl: [],
            queueType: { name: "Main" },
            queueTypeId: "q1",
            tags: ["a", "b"],
            hashTagPresetId: null,
            draftMeta: null,
          },
          longFormPost: null,
        }
      );

      const result = await getTemplatePrefill({
        id: "t-1",
        userId: TEST_USER_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.type).toBe("POST");
      expect(result?.post).toEqual({
        content: "Hello",
        caption: "Hello",
        fileUrl: [],
        queueType: "Main",
        queueTypeId: "q1",
        tags: "a b",
        hashTagPresetId: null,
        draftMeta: null,
      });
    });

    it("should return LONGFORM prefill when template has longFormPost", async () => {
      (prisma.template.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: "t-2",
          templateType: "LONGFORM",
          post: null,
          longFormPost: {
            title: "Article",
            summary: "Summary",
            content: "# Hi",
            image: "https://example.com/img.png",
            tags: ["tag1"],
            queueType: { name: "Main" },
          },
        }
      );

      const result = await getTemplatePrefill({
        id: "t-2",
        userId: TEST_USER_ID,
      });

      expect(result).not.toBeNull();
      expect(result?.type).toBe("LONGFORM");
      expect(result?.longform).toEqual({
        title: "Article",
        summary: "Summary",
        content: "# Hi",
        image: "https://example.com/img.png",
        tags: ["tag1"],
        queueType: { name: "Main" },
      });
    });
  });
});
