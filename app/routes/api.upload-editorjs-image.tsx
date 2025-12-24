import {
  json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  processImageForWeb,
  validateImageBuffer,
  getImageInfo,
} from "~/features/upload/image-resize.server";
import { uploadEditorJSImage } from "~/features/upload/s3.server";
import { getUserUploadProvider } from "~/models/user.server";

export async function action({ request }) {
  try {
    // Ensure user is authenticated
    const userId = await requireUserId(request);

    // Check user's upload provider preference
    const uploadProvider = await getUserUploadProvider(userId);

    // If user prefers blossom, handle it differently
    if (uploadProvider.includes("BLOSSOM")) {
      return json({
        success: 0,
        error: "EditorJS uploads with Blossom are not supported. Please use the Asset Browser to insert images into your content.",
      });
    }

    // Continue with S3 upload for EditorJS

    // Check content type
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return json({
        success: 0,
        error: "Request must be multipart/form-data",
      });
    }

    const uploadHandler = composeUploadHandlers(
      createMemoryUploadHandler({
        maxPartSize: 10 * 1024 * 1024, // 10MB max
      }),
    );
    const formData = await parseMultipartFormData(request, uploadHandler);

    const imageFile = formData.get("image") || formData.get("imageFile");

    if (!imageFile) {
      return json({
        success: 0,
        error: "No image file provided",
      });
    }

    // Handle File object
    if (imageFile instanceof File) {
      // Validate file type
      if (!imageFile.type.startsWith("image/")) {
        return json({
          success: 0,
          error: "File must be an image",
        });
      }

      // Validate file size (5MB limit)
      if (imageFile.size > 5 * 1024 * 1024) {
        return json({
          success: 0,
          error: "Image must be smaller than 5MB",
        });
      }

      try {
        // Convert File to Buffer for upload
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate the image buffer
        const isValidImage = await validateImageBuffer(buffer);
        if (!isValidImage) {
          return json({
            success: 0,
            error: "Invalid image file format",
          });
        }

        // Get image info for logging
        const _imageInfo = await getImageInfo(buffer);

        // Process the image with Sharp for optimization and metadata removal
        const processedBuffer = await processImageForWeb(buffer, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 85,
          format: "jpeg",
        });

        // Upload to S3 using EditorJS-specific function
        const imageUrl = await uploadEditorJSImage(
          processedBuffer,
          userId,
          imageFile.name,
        );
        // Return EditorJS compatible response
        return json({
          success: 1,
          file: {
            url: imageUrl,
            size: processedBuffer.length,
            name: imageFile.name.replace(/\.[^/.]+$/, ".jpg"), // Always .jpg since we convert
            extension: "jpg",
          },
        });
      } catch (uploadError) {
        console.error("Image upload error:", uploadError instanceof Error ? uploadError.message : uploadError);
        return json({
          success: 0,
          error: `Upload failed: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
        });
      }
    }

    // Handle string URL (if it's already a URL)
    if (typeof imageFile === "string" && imageFile.startsWith("https://")) {
      return json({
        success: 1,
        file: {
          url: imageFile,
          size: 0,
          name: "asset-image",
          extension: "jpg",
        },
      });
    }

    return json({
      success: 0,
      error: "Invalid file format",
    });
  } catch (error) {
    console.error("EditorJS upload API error:", error instanceof Error ? error.message : error);

    // Always return JSON, never HTML
    return json(
      {
        success: 0,
        error: `API Error: ${error.message || "Upload failed"}`,
      },
      { status: 500 },
    );
  }
}

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "EditorJS Image Upload API" });
}
