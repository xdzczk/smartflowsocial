import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/upload/services/media-ingest.server", () => ({
  commitMediaIngest: vi.fn(),
}));

import { requireUserId } from "~/features/auth";
import { commitMediaIngest } from "~/features/upload/services/media-ingest.server";
import { action, loader } from "~/routes/api.media.commit";

describe("API: Media Commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
    (commitMediaIngest as ReturnType<typeof vi.fn>).mockResolvedValue({
      committed: [
        {
          mediaId: "media-1",
          assetId: "asset-1",
          status: "processing",
          fileName: "photo.jpg",
          url: "https://cdn.example.com/photo.jpg",
        },
      ],
    });
  });

  it("returns commit payload for valid request", async () => {
    const request = new Request("http://localhost:3000/api/media/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            fileName: "photo.jpg",
            url: "https://cdn.example.com/photo.jpg",
            size: 1234,
            mimeType: "image/jpeg",
            provider: "S3",
          },
        ],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const responseObj =
      response instanceof Response
        ? response
        : new Response(JSON.stringify(response));
    const data = (await responseObj.json()) as { committed?: unknown[] };

    expect(responseObj.status).toBe(200);
    expect(Array.isArray(data.committed)).toBe(true);
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost:3000/api/media/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ fileName: "photo.jpg" }] }),
    });

    const response = await action({ request, params: {}, context: {} });
    const responseObj =
      response instanceof Response
        ? response
        : new Response(JSON.stringify(response));

    expect(responseObj.status).toBe(400);
  });

  it("loader returns endpoint description", async () => {
    const response = await loader();
    const data = (await response.json()) as { message?: string };
    expect(data.message).toBe("Media commit endpoint");
  });
});
