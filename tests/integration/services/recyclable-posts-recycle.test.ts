/**
 * Integration tests for Recyclable Posts Service Recycle Action
 * Tests app/features/posts/services/recyclable-posts.server.ts recycle action
 * that uses RecyclePostUseCase
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockRecycleExecute = vi.fn();

vi.mock("~/features/posts/use-cases/recycle-post.use-case.server", () => ({
  RecyclePostUseCase: class {
    execute = mockRecycleExecute;
  },
}));

vi.mock("~/lib/validation", () => ({
  recyclableActionSchema: {},
  validateFormDataOrRespond: vi.fn(),
}));

// RecyclePostUseCase is mocked above
import { TEST_USER_ID, TEST_POST_ID } from "../../utils/test-helpers";

import { handleRecyclablePostAction } from "~/features/posts/services/recyclable-posts.server";
import { validateFormDataOrRespond } from "~/lib/validation";

describe("Recyclable Posts Service Recycle Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecycleExecute.mockResolvedValue({
      newPostId: "new-post-123",
      scheduled: false,
    });
  });

  describe("handleRecycleAction", () => {
    it("should recycle a post using RecyclePostUseCase", async () => {
      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: {
          _action: "recycle",
          postId: TEST_POST_ID,
        },
      });

      const formData = new FormData();
      formData.append("_action", "recycle");
      formData.append("postId", TEST_POST_ID);

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(mockRecycleExecute).toHaveBeenCalledWith({
        originalPostId: TEST_POST_ID,
        userId: TEST_USER_ID,
      });

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.newPostId).toBe("new-post-123");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.scheduled).toBe(false);
    });

    it("should recycle a post with scheduling using RecyclePostUseCase", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockRecycleExecute.mockResolvedValue({
        newPostId: "new-post-456",
        scheduled: true,
      });

      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: {
          _action: "recycle",
          postId: TEST_POST_ID,
          scheduledFor: scheduledFor.toString(),
          queueTypeId: "queue-1",
        },
      });

      const formData = new FormData();
      formData.append("_action", "recycle");
      formData.append("postId", TEST_POST_ID);
      formData.append("scheduledFor", scheduledFor.toString());
      formData.append("queueTypeId", "queue-1");

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(mockRecycleExecute).toHaveBeenCalledWith({
        originalPostId: TEST_POST_ID,
        userId: TEST_USER_ID,
        scheduledFor,
        queueTypeId: "queue-1",
      });

      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.scheduled).toBe(true);
    });

    it("should handle recycle errors gracefully", async () => {
      mockRecycleExecute.mockRejectedValue(new Error("Post not recyclable"));

      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: {
          _action: "recycle",
          postId: TEST_POST_ID,
        },
      });

      const formData = new FormData();
      formData.append("_action", "recycle");
      formData.append("postId", TEST_POST_ID);

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      // Should handle error and return error response
      const responseObj =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // Error handler returns an error response
      expect(jsonResult).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing -- Test assertion on any-typed response
      expect(
        jsonResult.error || jsonResult.message || jsonResult.success
      ).toBeDefined();
    });

    it("should return validation error for invalid form data", async () => {
      (validateFormDataOrRespond as ReturnType<typeof vi.fn>).mockReturnValue({
        success: false,
        response: new Response(JSON.stringify({ error: "Validation failed" }), {
          status: 400,
        }),
      });

      const formData = new FormData();
      formData.append("_action", "recycle");
      // Missing postId

      const result = await handleRecyclablePostAction(formData, TEST_USER_ID);

      expect(result).toBeInstanceOf(Response);
      const responseObj = result;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Response.json() returns any
      const jsonResult = await responseObj.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Test assertion on any-typed response
      expect(jsonResult.error).toBe("Validation failed");
      expect(mockRecycleExecute).not.toHaveBeenCalled();
    });
  });
});
