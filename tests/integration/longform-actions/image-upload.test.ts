/**
 * Integration tests for image upload action in new longform handler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import "./shared-setup";
import {
  TEST_USER_ID,
  createMockUser,
  createMockQueueType,
  createMockFormData,
} from "../../utils/test-helpers";

import { formDataStore } from "./shared-setup";

import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";
import { uploadBufferToS3 } from "~/features/upload/s3.server";
import {
  getUserById,
  getQueueTypes,
  getQueueTypeByNameForUser,
} from "~/features/user";

describe("Image Upload Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["NOSTR_PUBLISHER_URL"] =
      "https://api.nostr-publisher.com/publish";
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockUser({ userRelays: ["wss://relay1.com", "wss://relay2.com"] })
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      createMockQueueType({ id: "queue-1", name: "posts" }),
      createMockQueueType({ id: "unassigned", name: "Unassigned" }),
    ]);
    (getQueueTypeByNameForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockQueueType({ id: "queue-1", name: "posts" })
    );
  });

  it("should return existing URL if imageFile is already a URL", async () => {
    const formData = createMockFormData({
      _action: "upload-image",
      imageFile: "https://example.com/image.jpg",
    });

    const request = new Request("http://localhost:3000/dashboard/newlongform", {
      method: "POST",
      body: formData,
    });

    const response = await handleNewLongFormAction(TEST_USER_ID, request);
    const dataRaw: unknown = await response.json();
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as { success?: unknown; error?: unknown })
        : {};

    expect(data).toEqual({
      success: true,
      imageUrl: "https://example.com/image.jpg",
    });
  });

  it("should upload File object to S3", async () => {
    const mockFile = new File(["test"], "image.jpg", { type: "image/jpeg" });
    (uploadBufferToS3 as ReturnType<typeof vi.fn>).mockResolvedValue(
      "https://s3.example.com/image.jpg"
    );

    const formData = new FormData();
    formData.append("_action", "upload-image");
    formData.append("imageFile", mockFile);

    const requestUrl = "http://localhost:3000/dashboard/newlongform";
    formDataStore.set(requestUrl, formData);

    const request = new Request(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data" },
      body: formData,
    });

    const response = await handleNewLongFormAction(TEST_USER_ID, request);
    const dataRaw: unknown = await response.json();
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as {
            success?: unknown;
            imageUrl?: unknown;
            error?: unknown;
          })
        : {};
    const success =
      typeof data.success === "boolean"
        ? data.success
        : data.success === true || data.success === 1;

    expect(uploadBufferToS3).toHaveBeenCalled();
    expect(success).toBe(true);
    expect(data.imageUrl).toBeDefined();
  });

  it("should handle S3 upload errors", async () => {
    const mockFile = new File(["test"], "image.jpg", { type: "image/jpeg" });
    (uploadBufferToS3 as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Upload failed")
    );

    const formData = new FormData();
    formData.append("_action", "upload-image");
    formData.append("imageFile", mockFile);

    const requestUrl = "http://localhost:3000/dashboard/newlongform";
    formDataStore.set(requestUrl, formData);

    const request = new Request(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data" },
      body: formData,
    });

    const response = await handleNewLongFormAction(TEST_USER_ID, request);
    const dataRaw: unknown = await response.json();
    const data =
      dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
        ? (dataRaw as {
            success?: unknown;
            imageUrl?: unknown;
            error?: unknown;
          })
        : {};
    const success =
      typeof data.success === "boolean"
        ? data.success
        : data.success === 0 || data.success === false;

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(success).toBe(false);
  });
});
