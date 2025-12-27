/**
 * Integration tests for link preview API route
 * 
 * Tests the API endpoint in app/routes/api.link-preview.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock global fetch
global.fetch = vi.fn();

import { loader } from "~/routes/api.link-preview";

describe("API: Link Preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful Requests", () => {
    it("should extract title, description, and image from HTML", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Page Title</title>
            <meta name="description" content="Test page description">
            <meta property="og:image" content="https://example.com/image.jpg">
          </head>
          <body>Content</body>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)",
          }),
        }),
      );
      expect(data).toEqual({
        success: 1,
        meta: {
          title: "Test Page Title",
          description: "Test page description",
          image: {
            url: "https://example.com/image.jpg",
          },
        },
      });
    });

    it("should handle missing meta tags gracefully", async () => {
      const mockHtml = `<html><head><title>Title Only</title></head></html>`;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({
        success: 1,
        meta: {
          title: "Title Only",
          description: "",
          image: {
            url: "",
          },
        },
      });
    });

    it("should handle description in reverse order meta tag", async () => {
      const mockHtml = `
        <html>
          <head>
            <meta content="Description text" name="description">
          </head>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.meta.description).toBe("Description text");
    });

    it("should handle og:image in reverse order meta tag", async () => {
      const mockHtml = `
        <html>
          <head>
            <meta content="https://example.com/image.jpg" property="og:image">
          </head>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.meta.image.url).toBe("https://example.com/image.jpg");
    });

    it("should trim extracted values", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>  Title with spaces  </title>
            <meta name="description" content="  Description with spaces  ">
          </head>
        </html>
      `;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.meta.title).toBe("Title with spaces");
      expect(data.meta.description).toBe("Description with spaces");
    });
  });

  describe("Error Handling", () => {
    it("should return validation error when url parameter is missing", async () => {
      const request = new Request("http://localhost:3000/api/link-preview");

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should return validation error for invalid URL format", async () => {
      const request = new Request(
        "http://localhost:3000/api/link-preview?url=not-a-url",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return validation error for non-http/https URLs", async () => {
      const request = new Request(
        "http://localhost:3000/api/link-preview?url=ftp://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should handle fetch connection errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle fetch timeout", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 6000);
        });
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.success).toBe(false);
    });

    it("should handle non-ok HTTP responses", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com/404",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it("should handle 5xx errors as 502", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.success).toBe(false);
    });

    it("should handle response text read errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => {
          throw new Error("Read error");
        },
      });

      const request = new Request(
        "http://localhost:3000/api/link-preview?url=https://example.com",
      );

      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.success).toBe(false);
    });
  });
});






