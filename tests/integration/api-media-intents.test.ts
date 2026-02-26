import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/features/upload/services/media-ingest.server", () => ({
  createMediaIngestIntent: vi.fn(),
}));

import { requireUserId } from "~/features/auth";
import { createMediaIngestIntent } from "~/features/upload/services/media-ingest.server";
import { action, loader } from "~/routes/api.media.intents";

describe("API: Media Intents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
    (createMediaIngestIntent as ReturnType<typeof vi.fn>).mockResolvedValue({
      intentId: "intent-1",
      provider: "S3",
      files: [
        {
          intentFileId: "file-1",
          fileName: "photo.jpg",
          size: 1234,
          mimeType: "image/jpeg",
          lane: "server_upload",
          uploadEndpoint: "/api/upload",
        },
      ],
    });
  });

  it("returns intent payload for valid request", async () => {
    const request = new Request("http://localhost:3000/api/media/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ fileName: "photo.jpg", size: 1234, mimeType: "image/jpeg" }],
      }),
    });

    const response = await action({ request, params: {}, context: {} });
    const responseObj =
      response instanceof Response
        ? response
        : new Response(JSON.stringify(response));
    const data = (await responseObj.json()) as {
      intentId?: string;
      files?: unknown[];
    };

    expect(responseObj.status).toBe(200);
    expect(data.intentId).toBe("intent-1");
    expect(Array.isArray(data.files)).toBe(true);
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost:3000/api/media/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [{ fileName: "photo.jpg" }] }),
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
    expect(data.message).toBe("Media intent endpoint");
  });
});
