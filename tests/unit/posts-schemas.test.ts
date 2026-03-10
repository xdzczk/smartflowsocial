/**
 * Unit tests for posts validation schemas
 * Tests app/lib/validation/schemas/posts.schemas.ts
 */

import { describe, it, expect } from "vitest";

import {
  postActionSchema,
  textPostSchema,
  imagePostSchema,
  longformPostSchema,
  bulkPostSchema,
  newPostBaseSchema,
  draftTextPostSchema,
  postOrScheduleTextSchema,
  draftImagePostSchema,
  postOrScheduleImageSchema,
  newPostActionSchema,
  uploadPreviewSchema,
  uploadImagesPreviewSchema,
  newLongformPostBaseSchema,
  saveDraftLongformSchema,
  scheduleLongformSchema,
  autosaveDraftLongformSchema,
  publishLongformSchema,
  uploadImageLongformSchema,
  newLongformPostActionSchema,
} from "~/lib/validation/schemas/posts.schemas";

describe("posts.schemas", () => {
  describe("postActionSchema", () => {
    it("accepts valid action values", () => {
      expect(postActionSchema.parse("draft-text")).toBe("draft-text");
      expect(postActionSchema.parse("publish")).toBe("publish");
      expect(postActionSchema.parse("schedule-longform")).toBe(
        "schedule-longform"
      );
    });

    it("rejects invalid action", () => {
      expect(() => postActionSchema.parse("invalid")).toThrow();
    });
  });

  describe("textPostSchema", () => {
    it("parses valid text post with required fields", () => {
      const result = textPostSchema.parse({
        _action: "post-text",
        content: "Hello world",
      });
      expect(result.content).toBe("Hello world");
      expect(result.queueType).toBe("unassigned");
      expect(result.isRecyclable).toBe(false);
    });

    it("rejects empty content", () => {
      expect(() =>
        textPostSchema.parse({ _action: "post-text", content: "" })
      ).toThrow();
    });

    it("rejects content over 5000 chars", () => {
      expect(() =>
        textPostSchema.parse({
          _action: "post-text",
          content: "x".repeat(5001),
        })
      ).toThrow();
    });
  });

  describe("imagePostSchema", () => {
    it("parses valid image post with optional caption", () => {
      const result = imagePostSchema.parse({
        _action: "post-image",
        caption: "A caption",
      });
      expect(result.caption).toBe("A caption");
      expect(result.queueType).toBe("unassigned");
    });

    it("rejects caption over 5000 chars", () => {
      expect(() =>
        imagePostSchema.parse({
          _action: "post-image",
          caption: "x".repeat(5001),
        })
      ).toThrow();
    });
  });

  describe("longformPostSchema", () => {
    it("parses valid longform with title and content", () => {
      const result = longformPostSchema.parse({
        _action: "save-draft",
        title: "My Title",
        content: "Body content",
      });
      expect(result.title).toBe("My Title");
      expect(result.content).toBe("Body content");
      expect(result.queueType).toBe("Unassigned");
    });

    it("rejects empty content", () => {
      expect(() =>
        longformPostSchema.parse({
          _action: "save-draft",
          content: "",
        })
      ).toThrow();
    });
  });

  describe("bulkPostSchema", () => {
    it("parses valid bulk posts array", () => {
      const result = bulkPostSchema.parse({
        posts: [{ content: "Post 1" }, { content: "Post 2" }],
      });
      expect(result.posts).toHaveLength(2);
      expect(result.posts[0]?.content).toBe("Post 1");
    });

    it("rejects empty content in post", () => {
      expect(() =>
        bulkPostSchema.parse({ posts: [{ content: "" }] })
      ).toThrow();
    });
  });

  describe("newPostBaseSchema", () => {
    it("applies defaults for optional fields", () => {
      const result = newPostBaseSchema.parse({ _action: "draft-text" });
      expect(result.caption).toBe("");
      expect(result.queueType).toBe("unassigned");
      expect(result.isRecyclable).toBe(false);
    });
  });

  describe("draftTextPostSchema", () => {
    it("parses draft-text action with content", () => {
      const result = draftTextPostSchema.parse({
        _action: "draft-text",
        content: "Draft content",
      });
      expect(result._action).toBe("draft-text");
      expect(result.content).toBe("Draft content");
    });
  });

  describe("postOrScheduleTextSchema", () => {
    it("parses post-text and schedule-text", () => {
      expect(
        postOrScheduleTextSchema.parse({ _action: "post-text", content: "x" })
      ).toBeDefined();
      expect(
        postOrScheduleTextSchema.parse({
          _action: "schedule-text",
          content: "x",
        })
      ).toBeDefined();
    });
  });

  describe("draftImagePostSchema", () => {
    it("parses draft-image, draft-images, draft-media", () => {
      const actions = ["draft-image", "draft-images", "draft-media"] as const;
      for (const action of actions) {
        const result = draftImagePostSchema.parse({ _action: action });
        expect(result._action).toBe(action);
      }
    });
  });

  describe("postOrScheduleImageSchema", () => {
    it("parses post-image and schedule-image variants", () => {
      const result = postOrScheduleImageSchema.parse({
        _action: "post-image",
      });
      expect(result._action).toBe("post-image");
    });
  });

  describe("newPostActionSchema", () => {
    it("parses draft-text discriminated union member", () => {
      const result = newPostActionSchema.parse({
        _action: "draft-text",
        content: "Hello",
      });
      expect(result._action).toBe("draft-text");
    });

    it("parses post-image discriminated union member", () => {
      const result = newPostActionSchema.parse({
        _action: "post-image",
      });
      expect(result._action).toBe("post-image");
    });

    it("rejects invalid _action", () => {
      expect(() =>
        newPostActionSchema.parse({ _action: "unknown", content: "x" })
      ).toThrow();
    });
  });

  describe("uploadPreviewSchema", () => {
    it("parses upload-images-preview and upload-media-preview", () => {
      expect(
        uploadPreviewSchema.parse({ _action: "upload-images-preview" })
      ).toBeDefined();
      expect(
        uploadPreviewSchema.parse({ _action: "upload-media-preview" })
      ).toBeDefined();
    });
  });

  describe("uploadImagesPreviewSchema", () => {
    it("transforms valid JSON uploadResults array", () => {
      const result = uploadImagesPreviewSchema.parse({
        uploadResults: JSON.stringify([
          { success: true, file: { url: "https://example.com/1.jpg" } },
        ]),
        scheduledDates: ["2025-01-01"],
        queueTypes: ["q1"],
      });
      expect(result.uploadResults).toHaveLength(1);
      expect(result.uploadResults[0]?.file?.url).toBe(
        "https://example.com/1.jpg"
      );
    });

    it("rejects when uploadResults is invalid JSON (transform catch returns [], then pipe min(1) fails)", () => {
      expect(() =>
        uploadImagesPreviewSchema.parse({
          uploadResults: "not-valid-json",
          scheduledDates: [],
          queueTypes: [],
        })
      ).toThrow();
    });

    it("rejects when uploadResults parses to non-array (transform returns [], then pipe min(1) fails)", () => {
      expect(() =>
        uploadImagesPreviewSchema.parse({
          uploadResults: "{}",
          scheduledDates: [],
          queueTypes: [],
        })
      ).toThrow();
    });
  });

  describe("newLongformPostBaseSchema", () => {
    it("applies default queueType", () => {
      const result = newLongformPostBaseSchema.parse({ _action: "save-draft" });
      expect(result.queueType).toBe("Unassigned");
    });
  });

  describe("saveDraftLongformSchema", () => {
    it("parses save-draft with content", () => {
      const result = saveDraftLongformSchema.parse({
        _action: "save-draft",
        content: "Draft body",
      });
      expect(result._action).toBe("save-draft");
      expect(result.content).toBe("Draft body");
    });
  });

  describe("scheduleLongformSchema", () => {
    it("parses schedule-longform with scheduledFor", () => {
      const result = scheduleLongformSchema.parse({
        _action: "schedule-longform",
        content: "Body",
        scheduledFor: "2025-06-01T12:00:00",
      });
      expect(result.scheduledFor).toBe("2025-06-01T12:00:00");
    });

    it("rejects empty scheduledFor", () => {
      expect(() =>
        scheduleLongformSchema.parse({
          _action: "schedule-longform",
          content: "Body",
          scheduledFor: "",
        })
      ).toThrow();
    });
  });

  describe("postActionSchema", () => {
    it("accepts all action values including upload-image", () => {
      expect(postActionSchema.parse("upload-image")).toBe("upload-image");
      expect(postActionSchema.parse("schedule-text")).toBe("schedule-text");
    });
  });

  describe("textPostSchema", () => {
    it("accepts scheduledFor and queueTypeId", () => {
      const result = textPostSchema.parse({
        _action: "schedule-text",
        content: "x",
        scheduledFor: "2025-06-01T12:00",
        queueTypeId: "qt-1",
      });
      expect(result.scheduledFor).toBe("2025-06-01T12:00");
      expect(result.queueTypeId).toBe("qt-1");
    });
  });

  describe("newPostActionSchema variants", () => {
    it("parses schedule-text", () => {
      const result = newPostActionSchema.parse({
        _action: "schedule-text",
        content: "x",
        scheduledFor: "2025-06-01T12:00",
      });
      expect(result._action).toBe("schedule-text");
      expect(result._action === "schedule-text" && result.content).toBe("x");
    });

    it("parses draft-images and draft-media", () => {
      expect(
        newPostActionSchema.parse({ _action: "draft-images" })._action
      ).toBe("draft-images");
      expect(
        newPostActionSchema.parse({ _action: "draft-media" })._action
      ).toBe("draft-media");
    });

    it("parses post-images and schedule-image", () => {
      expect(
        newPostActionSchema.parse({ _action: "post-images" })._action
      ).toBe("post-images");
      expect(
        newPostActionSchema.parse({ _action: "schedule-image", content: "" })
          ._action
      ).toBe("schedule-image");
    });

    it("rejects invalid _action", () => {
      expect(() =>
        newPostActionSchema.parse({ _action: "invalid", content: "x" })
      ).toThrow();
    });
  });

  describe("autosaveDraftLongformSchema", () => {
    it("parses autosave-draft with content", () => {
      const result = autosaveDraftLongformSchema.parse({
        _action: "autosave-draft",
        content: "Body",
      });
      expect(result._action).toBe("autosave-draft");
      expect(result.content).toBe("Body");
    });
  });

  describe("publishLongformSchema", () => {
    it("parses publish with content", () => {
      const result = publishLongformSchema.parse({
        _action: "publish",
        content: "Body",
      });
      expect(result._action).toBe("publish");
    });
  });

  describe("uploadImageLongformSchema", () => {
    it("parses upload-image action", () => {
      const result = uploadImageLongformSchema.parse({
        _action: "upload-image",
      });
      expect(result._action).toBe("upload-image");
    });
  });

  describe("newLongformPostActionSchema", () => {
    it("parses save-draft member", () => {
      const result = newLongformPostActionSchema.parse({
        _action: "save-draft",
        content: "x",
      });
      expect(result._action).toBe("save-draft");
    });

    it("parses publish and schedule-longform members", () => {
      expect(
        newLongformPostActionSchema.parse({ _action: "publish", content: "x" })
          ._action
      ).toBe("publish");
      expect(
        newLongformPostActionSchema.parse({
          _action: "schedule-longform",
          content: "x",
          scheduledFor: "2025-06-01T12:00",
        })._action
      ).toBe("schedule-longform");
    });

    it("rejects invalid _action", () => {
      expect(() =>
        newLongformPostActionSchema.parse({ _action: "invalid", content: "x" })
      ).toThrow();
    });
  });
});
