/**
 * File Upload Security Tests
 *
 * Tests that file uploads are properly validated and secured
 */

import { describe, it, expect } from "vitest";

import {
  validateUpload,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE,
} from "~/features/upload/validation.server";

// Helper to create a valid JPEG buffer (minimal valid JPEG)
function createValidJPEGBuffer(): Buffer {
  // Minimal valid JPEG: SOI marker + JFIF header + EOI marker
  const jpegHeader = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
  ]);
  return jpegHeader;
}

// Helper to create a valid PNG buffer (minimal valid PNG)
function createValidPNGBuffer(): Buffer {
  // Minimal valid PNG: PNG signature + IHDR chunk
  const pngHeader = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d, // IHDR chunk length
    0x49,
    0x48,
    0x44,
    0x52, // IHDR
    0x00,
    0x00,
    0x00,
    0x01, // width
    0x00,
    0x00,
    0x00,
    0x01, // height
    0x08,
    0x06,
    0x00,
    0x00,
    0x00, // bit depth, color type, compression, filter, interlace
    0x1f,
    0x15,
    0xc4,
    0x89, // CRC
    0x00,
    0x00,
    0x00,
    0x00, // IEND chunk length
    0x49,
    0x45,
    0x4e,
    0x44, // IEND
    0xae,
    0x42,
    0x60,
    0x82, // CRC
  ]);
  return pngHeader;
}

// Helper to create a buffer that looks like an executable
function createExecutableBuffer(): Buffer {
  // ELF header (Linux executable)
  return Buffer.from([
    0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

describe("File Upload Security: File Type Validation", () => {
  it("should validate MIME types using magic bytes", async () => {
    const jpegBuffer = createValidJPEGBuffer();
    const result = await validateUpload(jpegBuffer, "test.jpg");

    expect(result.valid).toBe(true);
    expect(result.detectedMimeType).toBe("image/jpeg");
  });

  it("should reject files with incorrect MIME type", async () => {
    const executableBuffer = createExecutableBuffer();
    const result = await validateUpload(executableBuffer, "malicious.exe");

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("not allowed");
  });

  it("should validate file content, not just extension", async () => {
    // Try to upload an executable with a .jpg extension
    const executableBuffer = createExecutableBuffer();
    const result = await validateUpload(executableBuffer, "malicious.jpg");

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    // Should detect actual file type, not trust extension
  });

  it("should reject files that cannot be detected", async () => {
    // Empty or invalid buffer
    const invalidBuffer = Buffer.from("not a valid file");
    const result = await validateUpload(invalidBuffer, "test.jpg");

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Could not detect");
  });

  it("should accept valid PNG files", async () => {
    const pngBuffer = createValidPNGBuffer();
    const result = await validateUpload(pngBuffer, "test.png");

    expect(result.valid).toBe(true);
    expect(result.detectedMimeType).toBe("image/png");
  });

  it("should validate against Content-Type header if provided", async () => {
    const jpegBuffer = createValidJPEGBuffer();

    // Valid: Content-Type matches detected type
    const validResult = await validateUpload(
      jpegBuffer,
      "test.jpg",
      "image/jpeg"
    );
    expect(validResult.valid).toBe(true);

    // Invalid: Content-Type doesn't match detected type
    const invalidResult = await validateUpload(
      jpegBuffer,
      "test.jpg",
      "image/png"
    );
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toContain("Content-Type mismatch");
  });

  it("should accept application/octet-stream when magic bytes match (iOS empty File.type)", async () => {
    const jpegBuffer = createValidJPEGBuffer();
    const result = await validateUpload(
      jpegBuffer,
      "photo.jpg",
      "application/octet-stream"
    );
    expect(result.valid).toBe(true);
    expect(result.detectedMimeType).toBe("image/jpeg");
  });

  it("should only allow whitelisted MIME types", async () => {
    // Test that only ALLOWED_MIME_TYPES are accepted
    const jpegBuffer = createValidJPEGBuffer();
    const result = await validateUpload(jpegBuffer, "test.jpg");

    if (result.valid && result.detectedMimeType) {
      expect(ALLOWED_MIME_TYPES).toContain(result.detectedMimeType);
    }
  });
});

describe("File Upload Security: File Size Limits", () => {
  it("should enforce maximum file size", async () => {
    // Create a buffer larger than MAX_FILE_SIZE
    const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1);
    const result = await validateUpload(largeBuffer, "large.jpg");

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("exceeds");
    expect(result.error).toContain("MB limit");
  });

  it("should accept files within size limit", async () => {
    const jpegBuffer = createValidJPEGBuffer();
    const result = await validateUpload(jpegBuffer, "test.jpg");

    expect(result.valid).toBe(true);
  });

  it("should validate size before MIME type detection", async () => {
    // Very large invalid file should fail on size first
    const largeInvalidBuffer = Buffer.alloc(MAX_FILE_SIZE + 1);
    const result = await validateUpload(largeInvalidBuffer, "large.bin");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds");
    // Should not have detectedMimeType since size check happens first
  });
});

describe("File Upload Security: Constants", () => {
  it("should have MAX_FILE_SIZE defined", () => {
    expect(MAX_FILE_SIZE).toBeGreaterThan(0);
    expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024); // 100MB absolute cap
    expect(MAX_IMAGE_FILE_SIZE).toBe(10 * 1024 * 1024);
    expect(MAX_VIDEO_FILE_SIZE).toBe(100 * 1024 * 1024);
  });

  it("should have ALLOWED_MIME_TYPES defined", () => {
    expect(ALLOWED_MIME_TYPES.length).toBeGreaterThan(0);
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("video/mp4");
  });

  it("should only allow image MIME types", () => {
    // Verify no dangerous types are allowed
    const dangerousTypes = [
      "application/javascript",
      "application/x-executable",
      "text/html",
      "application/x-msdownload", // .exe
    ];

    dangerousTypes.forEach((type) => {
      expect(ALLOWED_MIME_TYPES).not.toContain(type);
    });
  });
});

describe("File Upload Security: Edge Cases", () => {
  it("should handle empty buffer", async () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = await validateUpload(emptyBuffer, "empty.jpg");

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should handle very small buffers", async () => {
    const tinyBuffer = Buffer.from([0x01, 0x02, 0x03]);
    const result = await validateUpload(tinyBuffer, "tiny.bin");

    expect(result.valid).toBe(false);
    // Should fail MIME detection for too-small buffer
  });

  it("should normalize Content-Type with charset", async () => {
    const jpegBuffer = createValidJPEGBuffer();

    // Content-Type with charset should still work
    const result = await validateUpload(
      jpegBuffer,
      "test.jpg",
      "image/jpeg; charset=utf-8"
    );

    expect(result.valid).toBe(true);
  });
});
