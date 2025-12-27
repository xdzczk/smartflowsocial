import type { ActionFunctionArgs } from "@remix-run/node";
import { json ,
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
import { loadUploadProviderSettings } from "~/features/user/services/upload-provider.server";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";
import {
  ValidationError,
  ExternalServiceError,
} from "~/lib/errors";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    // Ensure user is authenticated
    const userId = await requireUserId(request);

    // Check user's upload provider preference
    const { provider } = await loadUploadProviderSettings(userId);
    const uploadProvider = provider;

    // If user prefers blossom, handle it differently
    if (uploadProvider.includes("BLOSSOM")) {
      throw new ValidationError(
        "EditorJS uploads with Blossom are not supported. Please use the Asset Browser to insert images into your content.",
      );
    }

    // Continue with S3 upload for EditorJS

    // Check content type
    const contentType = request.headers.get("content-type") || "";
    assert(
      contentType.includes("multipart/form-data"),
      "Request must be multipart/form-data",
      { contentType },
    );

    let formData: FormData;
    try {
      const uploadHandler = composeUploadHandlers(
        createMemoryUploadHandler({
          maxPartSize: 10 * 1024 * 1024, // 10MB max
        }),
      );
      formData = await parseMultipartFormData(request, uploadHandler);
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to parse multipart form data",
        400,
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }

    const imageFile = formData.get("image") || formData.get("imageFile");
    assert(imageFile !== null, "No image file provided", {
      formDataKeys: Array.from(formData.keys()),
    });

    // Handle File object
    if (imageFile instanceof File) {
      // Validate file type
      assert(
        imageFile.type.startsWith("image/"),
        "File must be an image",
        { fileType: imageFile.type },
      );

      // Validate file size (5MB limit)
      assert(
        imageFile.size <= 5 * 1024 * 1024,
        "Image must be smaller than 5MB",
        { fileSize: imageFile.size, maxSize: 5 * 1024 * 1024 },
      );

      // Convert File to Buffer for upload
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate the image buffer
      const isValidImage = await validateImageBuffer(buffer);
      assert(isValidImage, "Invalid image file format");

      // Get image info for logging
      const _imageInfo = await getImageInfo(buffer);

      // Process the image with Sharp for optimization and metadata removal
      let processedBuffer: Buffer;
      try {
        processedBuffer = await processImageForWeb(buffer, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 85,
          format: "jpeg",
        });
      } catch (error) {
        throw new ExternalServiceError(
          "Failed to process image",
          500,
          {
            service: "ImageProcessing",
            originalError: error instanceof Error ? error.message : String(error),
          },
        );
      }

      // Upload to S3 using EditorJS-specific function
      let imageUrl: string;
      try {
        imageUrl = await uploadEditorJSImage(
          processedBuffer,
          userId,
          imageFile.name,
        );
      } catch (error) {
        throw new ExternalServiceError(
          "Failed to upload image to storage",
          500,
          {
            service: "S3",
            fileName: imageFile.name,
            originalError: error instanceof Error ? error.message : String(error),
          },
        );
      }

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

    // Check if it's a File object
    const isFile = typeof imageFile === "object" && imageFile !== null && "name" in imageFile && "size" in imageFile;
    throw new ValidationError("Invalid file format", {
      fileType: typeof imageFile,
      isFile,
    });
  },
);

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "EditorJS Image Upload API" });
}
