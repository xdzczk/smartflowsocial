import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  loadUploadProviderSettings: vi.fn(),
}));

vi.mock("~/features/upload", () => ({
  createMedia: vi.fn(),
}));

import { requireUserId } from "~/features/auth";
import { loadUploadProviderSettings } from "~/features/user";
import { action, loader } from "~/routes/api.upload-blossom";

describe("API: Upload Blossom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
    (loadUploadProviderSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      provider: "BLOSSOM_SFS",
    });
  });

  it("returns normalized file payload for valid blossom tags", async () => {
    const request = new Request("http://localhost:3000/api/upload-blossom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "cover.jpg",
        tags: [
          ["url", "https://blossom.smartflow.social/media/cover.jpg"],
          ["x", "abc123"],
          ["size", "1024"],
          ["m", "image/jpeg"],
        ],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const responseObj =
      response instanceof Response
        ? response
        : new Response(JSON.stringify(response));
    const data = (await responseObj.json()) as {
      success?: boolean;
      data?: { file?: { url?: string; provider?: string } };
    };

    expect(responseObj.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data?.file?.url).toBe(
      "https://blossom.smartflow.social/media/cover.jpg"
    );
    expect(data.data?.file?.provider).toBe("BLOSSOM_SFS");
  });

  it("rejects when user provider is not blossom", async () => {
    (loadUploadProviderSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      provider: "S3",
    });

    const request = new Request("http://localhost:3000/api/upload-blossom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tags: [["url", "https://example.com/a.jpg"]],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const responseObj =
      response instanceof Response
        ? response
        : new Response(JSON.stringify(response));

    expect(responseObj.status).toBe(403);
  });

  it("returns validation error when required tags are missing", async () => {
    const request = new Request("http://localhost:3000/api/upload-blossom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tags: [["url", "https://example.com/a.jpg"]],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const responseObj =
      response instanceof Response
        ? response
        : new Response(JSON.stringify(response));
    const data = (await responseObj.json()) as {
      success?: boolean;
      error?: unknown;
    };

    expect(responseObj.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it("loader returns endpoint description", async () => {
    const response = await loader();
    const data = (await response.json()) as { message?: string };
    expect(data.message).toBe("Blossom Upload API");
  });
});
