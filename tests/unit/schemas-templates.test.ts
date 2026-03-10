/**
 * Unit tests for template schemas
 * Tests app/lib/validation/schemas/templates.schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  deleteTemplateSchema,
  scheduleTemplateSchema,
  bulkDeleteTemplatesSchema,
  createTemplateFromScratchPostSchema,
  createTemplateFromScratchLongformSchema,
  templatesActionSchema,
  updateTemplateNameSchema,
  updateTemplatePostSchema,
  updateTemplateLongformSchema,
  templateEditActionSchema,
} from "~/lib/validation/schemas/templates.schemas";

describe("templates.schemas", () => {
  describe("deleteTemplateSchema", () => {
    it("parses _action delete and templateId", () => {
      const result = deleteTemplateSchema.parse({
        _action: "delete",
        templateId: "tpl-1",
      });
      expect(result._action).toBe("delete");
      expect(result.templateId).toBe("tpl-1");
    });
    it("rejects empty templateId", () => {
      expect(() =>
        deleteTemplateSchema.parse({ _action: "delete", templateId: "" })
      ).toThrow();
    });
  });

  describe("scheduleTemplateSchema", () => {
    it("parses _action schedule and templateId", () => {
      const result = scheduleTemplateSchema.parse({
        _action: "schedule",
        templateId: "tpl-1",
      });
      expect(result._action).toBe("schedule");
      expect(result.templateId).toBe("tpl-1");
    });
  });

  describe("bulkDeleteTemplatesSchema", () => {
    it("parses _action bulkDelete", () => {
      const result = bulkDeleteTemplatesSchema.parse({
        _action: "bulkDelete",
      });
      expect(result._action).toBe("bulkDelete");
    });
  });

  describe("createTemplateFromScratchPostSchema", () => {
    it("parses createTemplate with templateName and defaults", () => {
      const result = createTemplateFromScratchPostSchema.parse({
        _action: "createTemplate",
        templateName: "My Template",
      });
      expect(result._action).toBe("createTemplate");
      expect(result.templateName).toBe("My Template");
      expect(result.content).toBe("");
      expect(result.queueType).toBe("unassigned");
    });
    it("rejects empty templateName", () => {
      expect(() =>
        createTemplateFromScratchPostSchema.parse({
          _action: "createTemplate",
          templateName: "",
        })
      ).toThrow();
    });
    it("transforms fileUrl JSON array", () => {
      const result = createTemplateFromScratchPostSchema.parse({
        _action: "createTemplate",
        templateName: "T",
        fileUrl: JSON.stringify(["https://a.com/img.jpg"]),
      });
      expect(result.fileUrl).toEqual(["https://a.com/img.jpg"]);
    });
    it("transforms invalid fileUrl to empty array", () => {
      const result = createTemplateFromScratchPostSchema.parse({
        _action: "createTemplate",
        templateName: "T",
        fileUrl: "not-json",
      });
      expect(result.fileUrl).toEqual([]);
    });
  });

  describe("createTemplateFromScratchLongformSchema", () => {
    it("parses createTemplate longform with defaults", () => {
      const result = createTemplateFromScratchLongformSchema.parse({
        _action: "createTemplate",
        templateName: "Longform Template",
      });
      expect(result.templateName).toBe("Longform Template");
      expect(result.title).toBe("");
      expect(result.content).toBe("");
      expect(result.queueType).toBe("unassigned");
    });
    it("transforms useHashtagPresets true", () => {
      const result = createTemplateFromScratchLongformSchema.parse({
        _action: "createTemplate",
        templateName: "T",
        useHashtagPresets: "true",
      });
      expect(result.useHashtagPresets).toBe(true);
    });
  });

  describe("templatesActionSchema", () => {
    it("parses delete member", () => {
      const result = templatesActionSchema.parse({
        _action: "delete",
        templateId: "t1",
      });
      expect(result._action).toBe("delete");
    });
    it("parses schedule member", () => {
      const result = templatesActionSchema.parse({
        _action: "schedule",
        templateId: "t1",
      });
      expect(result._action).toBe("schedule");
    });
    it("parses bulkDelete member", () => {
      const result = templatesActionSchema.parse({ _action: "bulkDelete" });
      expect(result._action).toBe("bulkDelete");
    });
  });

  describe("updateTemplateNameSchema", () => {
    it("parses updateName with name", () => {
      const result = updateTemplateNameSchema.parse({
        _action: "updateName",
        name: "New Name",
      });
      expect(result._action).toBe("updateName");
      expect(result.name).toBe("New Name");
    });
  });

  describe("updateTemplatePostSchema", () => {
    it("parses updateTemplatePost with templateId and postId", () => {
      const result = updateTemplatePostSchema.parse({
        _action: "updateTemplatePost",
        templateId: "t1",
        postId: "p1",
        content: "Updated",
      });
      expect(result.templateId).toBe("t1");
      expect(result.postId).toBe("p1");
      expect(result.content).toBe("Updated");
    });
    it("applies default content when omitted", () => {
      const result = updateTemplatePostSchema.parse({
        _action: "updateTemplatePost",
        templateId: "t1",
        postId: "p1",
      });
      expect(result.content).toBe("");
    });
  });

  describe("updateTemplateLongformSchema", () => {
    it("parses updateTemplateLongform", () => {
      const result = updateTemplateLongformSchema.parse({
        _action: "updateTemplateLongform",
        templateId: "t1",
        longFormPostId: "lf1",
      });
      expect(result.templateId).toBe("t1");
      expect(result.longFormPostId).toBe("lf1");
    });
  });

  describe("templateEditActionSchema", () => {
    it("parses updateName", () => {
      const result = templateEditActionSchema.parse({
        _action: "updateName",
        name: "N",
      });
      expect(result._action).toBe("updateName");
    });
    it("parses delete", () => {
      const result = templateEditActionSchema.parse({ _action: "delete" });
      expect(result._action).toBe("delete");
    });
    it("parses deleteTemplate", () => {
      const result = templateEditActionSchema.parse({
        _action: "deleteTemplate",
      });
      expect(result._action).toBe("deleteTemplate");
    });
    it("parses schedule", () => {
      const result = templateEditActionSchema.parse({ _action: "schedule" });
      expect(result._action).toBe("schedule");
    });
    it("parses updateTemplatePost", () => {
      const result = templateEditActionSchema.parse({
        _action: "updateTemplatePost",
        templateId: "t1",
        postId: "p1",
      });
      expect(result._action).toBe("updateTemplatePost");
    });
    it("parses updateTemplateLongform", () => {
      const result = templateEditActionSchema.parse({
        _action: "updateTemplateLongform",
        templateId: "t1",
        longFormPostId: "lf1",
      });
      expect(result._action).toBe("updateTemplateLongform");
    });
  });
});
