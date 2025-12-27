/**
 * Integration tests for upload API route
 * 
 * Tests the API endpoint in app/routes/api.upload.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/upload/s3.server", () => ({
  createUploadHandler: vi.fn(() => vi.fn()),
}));

// Mock Remix upload handlers
vi.mock("@remix-run/node", async () => {
  const actual = await vi.importActual("@remix-run/node");
  return {
    ...actual,
    unstable_composeUploadHandlers: vi.fn((...handlers) => {
      return async (name: string, stream: any, info: any) => {
        // Mock upload handler that returns a URL
        return "https://example.com/uploaded-file.jpg";
      };
    }),
    unstable_createMemoryUploadHandler: vi.fn(() => vi.fn()),
    unstable_parseMultipartFormData: vi.fn(async (request, handler) => {
      const formData = new FormData();
      formData.append("file", "https://example.com/uploaded-file.jpg");
      return formData;
    }),
  };
});

import { requireUserId } from "~/features/auth/session.server";
import { action, loader } from "~/routes/api.upload";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
  });

  describe("Action Handler", () => {
    describe("Successful Requests", () => {
      it("should upload file and return URL", async () => {
        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundary",
          },
          body: new FormData(),
        });

        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        expect(requireUserId).toHaveBeenCalledWith(request);
        expect(data).toEqual({
          success: true,
          data: {
            fileUrl: "https://example.com/uploaded-file.jpg",
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should require authentication", async () => {
        (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Authentication required"),
        );

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        // requireUserId throws a Response (redirect), not an Error
        const response = await action({ request, params: {}, context: {} });
        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it("should return validation error for non-multipart content type", async () => {
        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should handle multipart parsing errors", async () => {
        const { unstable_parseMultipartFormData } = await import("@remix-run/node");
        (unstable_parseMultipartFormData as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Parse error"),
        );

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it("should return validation error when no file provided", async () => {
        const { unstable_parseMultipartFormData } = await import("@remix-run/node");
        (unstable_parseMultipartFormData as ReturnType<typeof vi.fn>).mockResolvedValue(
          new FormData(), // Empty form data
        );

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it("should return validation error when file upload fails (no URL)", async () => {
        const { unstable_parseMultipartFormData } = await import("@remix-run/node");
        const formData = new FormData();
        formData.append("file", "not-a-url");
        (unstable_parseMultipartFormData as ReturnType<typeof vi.fn>).mockResolvedValue(
          formData,
        );

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });
    });
  });

  describe("Loader Handler", () => {
    it("should return API description", async () => {
      const request = new Request("http://localhost:3000/api/upload", {
        method: "GET",
      });

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({ message: "General File Upload API" });
    });
  });
});

