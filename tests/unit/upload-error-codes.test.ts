import { describe, expect, it } from "vitest";

import {
  UploadErrorCodes,
  inferUploadErrorCodeFromMessage,
  mapUnknownToUploadError,
} from "~/features/upload/upload-error-codes";

describe("upload-error-codes", () => {
  it("inferUploadErrorCodeFromMessage maps signer strings", () => {
    expect(inferUploadErrorCodeFromMessage("Nostr signer not available")).toBe(
      UploadErrorCodes.SIGNER_NOT_READY
    );
    expect(inferUploadErrorCodeFromMessage("Connection check timeout")).toBe(
      UploadErrorCodes.SIGNER_TIMEOUT
    );
  });

  it("inferUploadErrorCodeFromMessage maps HTTP 413", () => {
    expect(inferUploadErrorCodeFromMessage("x", { httpStatus: 413 })).toBe(
      UploadErrorCodes.UPLOAD_FILE_TOO_LARGE
    );
  });

  it("mapUnknownToUploadError returns code and message", () => {
    const m = mapUnknownToUploadError(new Error("failed to fetch"));
    expect(m.code).toBe(UploadErrorCodes.UPLOAD_NETWORK_ERROR);
    expect(m.message.length).toBeGreaterThan(0);
  });
});
