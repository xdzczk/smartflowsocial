import imageCompression from "browser-image-compression";

/**
 * Completely strips all metadata (EXIF, IPTC, XMP) from images and resizes them
 * for better performance and enhanced user privacy.
 *
 * @param file - The original image file to process
 * @param customOptions - Optional configuration overrides
 * @returns A new File object with metadata removed and size optimized
 */
export async function resizeImage(
  file: File,
  customOptions: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    fileType?: string;
    preserveExif?: boolean;
    [key: string]: unknown;
  } = {},
) {
  // Default options focused on privacy and optimization
  const options = {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: "image/jpeg",
    // Explicitly disable EXIF preservation for privacy
    preserveExif: false,
    // Additional options
    ...customOptions,
  };

  try {
    // Step 1: Compress and resize the image with browser-image-compression
    const compressedFile = await imageCompression(file, options);

    // Step 2: Use canvas to create a completely clean image without metadata
    // This creates a new image data representation, effectively removing all metadata
    const cleanImage = await stripAllMetadata(compressedFile);

    // Step 3: Create a new file with the clean image data
    const newFile = new File([cleanImage], `${file.name.split(".")[0]}.jpg`, {
      type: "image/jpeg",
      lastModified: new Date().getTime(), // Update last modified time
    });

    return newFile;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error processing image:", error);
    throw error;
  }
}

/**
 * Strips all metadata from an image by drawing it to a canvas and re-encoding it.
 * This process removes all embedded metadata (EXIF, IPTC, XMP) for enhanced privacy.
 *
 * @param file - The image file to strip metadata from
 * @returns A Blob containing the image data with all metadata removed
 */
async function stripAllMetadata(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        // Create a canvas element
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image to the canvas - this step strips all metadata
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Draw with a clean white background first to handle transparency
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Convert to blob with high quality JPEG (0.92 quality)
        canvas.toBlob(
          (blob) => {
            // Clean up the URL object
            URL.revokeObjectURL(url);

            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create image blob"));
            }
          },
          "image/jpeg",
          0.92,
        );
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
