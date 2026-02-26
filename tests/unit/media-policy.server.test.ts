import { describe, expect, it } from "vitest";

import { evaluateMediaPolicy } from "~/features/upload/services/media-policy.server";

describe("evaluateMediaPolicy", () => {
  it("allows valid image payloads within limit", () => {
    const result = evaluateMediaPolicy({
      mimeType: "image/jpeg",
      sizeBytes: 1024 * 1024,
    });
    expect(result.allowed).toBe(true);
    expect(result.mediaClass).toBe("image");
  });

  it("rejects oversized images", () => {
    const result = evaluateMediaPolicy({
      mimeType: "image/jpeg",
      sizeBytes: 11 * 1024 * 1024,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("image_too_large");
  });

  it("allows valid video payloads within limit", () => {
    const result = evaluateMediaPolicy({
      mimeType: "video/mp4",
      sizeBytes: 80 * 1024 * 1024,
    });
    expect(result.allowed).toBe(true);
    expect(result.mediaClass).toBe("video");
  });

  it("rejects unsupported media types", () => {
    const result = evaluateMediaPolicy({
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unsupported_media_type");
  });
});
