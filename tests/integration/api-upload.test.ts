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
    unstable_composeUploadHandlers: vi.fn((..._handlers) => {
      return async (_name: string, _stream: unknown, _info: unknown) => {
        // Mock upload handler that returns a URL
        return "https://example.com/uploaded-file.jpg";
      };
    }),
    unstable_createMemoryUploadHandler: vi.fn(() => vi.fn()),
    unstable_parseMultipartFormData: vi.fn(async (_request, _handler) => {
      const formData = new FormData();
      formData.append("file", "https://example.com/uploaded-file.jpg");
      return formData;
    }),
  };
});

import { TEST_USER_ID } from "../utils/test-helpers";

import { requireUserId } from "~/features/auth/session.server";
import { action, loader } from "~/routes/api.upload";

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
            "Content-Type":
              "multipart/form-data; boundary=----WebKitFormBoundary",
          },
          body: new FormData(),
        });

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const responseObj =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response));
        const dataRaw: unknown = await responseObj.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                fileUrl?: unknown;
                error?: unknown;
              })
            : {};

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
          new Error("Authentication required")
        );

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        // requireUserId throws a Response (redirect), not an Error
        const response = await action({ request, params: {}, context: {} });
        const responseObj =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response));
        expect(responseObj.status).toBeGreaterThanOrEqual(400);
      });

      it("should return validation error for non-multipart content type", async () => {
        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const responseObj =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response));
        const dataRaw: unknown = await responseObj.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                fileUrl?: unknown;
                error?: unknown;
              })
            : {};

        expect(responseObj.status).toBe(400);
        const success =
          typeof data.success === "boolean"
            ? data.success
            : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should handle multipart parsing errors", async () => {
        const { unstable_parseMultipartFormData } = await import(
          "@remix-run/node"
        );
        (
          unstable_parseMultipartFormData as ReturnType<typeof vi.fn>
        ).mockRejectedValue(new Error("Parse error"));

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const responseObj =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response));
        const dataRaw: unknown = await responseObj.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                fileUrl?: unknown;
                error?: unknown;
              })
            : {};

        expect(responseObj.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it("should return validation error when no file provided", async () => {
        const { unstable_parseMultipartFormData } = await import(
          "@remix-run/node"
        );
        (
          unstable_parseMultipartFormData as ReturnType<typeof vi.fn>
        ).mockResolvedValue(
          new FormData() // Empty form data
        );

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const responseObj =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response));
        const dataRaw: unknown = await responseObj.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                fileUrl?: unknown;
                error?: unknown;
              })
            : {};

        expect(responseObj.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it("should return validation error when file upload fails (no URL)", async () => {
        const { unstable_parseMultipartFormData } = await import(
          "@remix-run/node"
        );
        const formData = new FormData();
        formData.append("file", "not-a-url");
        (
          unstable_parseMultipartFormData as ReturnType<typeof vi.fn>
        ).mockResolvedValue(formData);

        const request = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const responseObj =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response));
        const dataRaw: unknown = await responseObj.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                fileUrl?: unknown;
                error?: unknown;
              })
            : {};

        expect(responseObj.status).toBe(400);
        expect(data.success).toBe(false);
      });
    });
  });

  describe("Loader Handler", () => {
    it("should return API description", async () => {
      const _request = new Request("http://localhost:3000/api/upload", {
        method: "GET",
      });

      const loaderFn = loader as () => Promise<Response>;
      const response = await loaderFn();
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as { message?: unknown })
          : {};

      expect(data).toEqual({ message: "General File Upload API" });
    });
  });
});
