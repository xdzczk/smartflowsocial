import sharp from "sharp";

import { logError } from "~/lib/error-logger.server";
/**
 * Server-side image processing using Sharp
 * Optimizes images for web use while removing metadata
 */
export async function processImageForWeb(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: "jpeg" | "png" | "webp";
  } = {}
): Promise<Buffer> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 80,
    format = "jpeg",
  } = options;

  try {
    let sharpInstance = sharp(buffer)
      // Remove all metadata (EXIF, IPTC, XMP) for privacy
      .withMetadata({})
      // Resize if larger than max dimensions
      .resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });

    // Apply format-specific processing
    switch (format) {
      case "jpeg":
        sharpInstance = sharpInstance.jpeg({
          quality,
          progressive: true,
          mozjpeg: true, // Use mozjpeg encoder for better compression
        });
        break;
      case "png":
        sharpInstance = sharpInstance.png({
          quality,
          compressionLevel: 9,
        });
        break;
      case "webp":
        sharpInstance = sharpInstance.webp({
          quality,
          effort: 6, // Higher effort for better compression
        });
        break;
      default:
        sharpInstance = sharpInstance.jpeg({ quality });
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Sharp image processing error",
      options,
      bufferSize: buffer.length,
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Image processing failed: ${errorMessage}`);
  }
}

/**
 * Get image metadata without processing
 */
export async function getImageInfo(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error getting image info",
      bufferSize: buffer.length,
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read image metadata: ${errorMessage}`);
  }
}

/**
 * Validate image buffer
 */
export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  try {
    await sharp(buffer).metadata();
    return true;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Image validation failed",
      bufferSize: buffer.length,
    });
    return false;
  }
}
