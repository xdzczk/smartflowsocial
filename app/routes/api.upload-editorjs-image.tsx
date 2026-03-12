import type { ActionFunctionArgs } from "@remix-run/node";
import {
  json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  processImageForWeb,
  validateImageBuffer,
  getImageInfo,
} from "~/features/upload/image-resize.server";
import { uploadEditorJSImage } from "~/features/upload/s3.server";
import { loadUploadProviderSettings } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError, ExternalServiceError } from "~/lib/errors";

const CONTENT_TYPE_MULTIPART_FORM_DATA = "multipart/form-data";
const CONTENT_TYPE_APPLICATION_JSON = "application/json";
const HTTPS_PREFIX = "https://";
const EDITORJS_DEFAULT_NAME = "asset-image";
const EDITORJS_MAX_PART_SIZE = 10 * 1024 * 1024; // 10MB max

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

function createEditorJsUrlResponse(url: string) {
  return json({
    success: 1,
    file: {
      url,
      size: 0,
      name: EDITORJS_DEFAULT_NAME,
      extension: "jpg",
    },
  });
}

async function handleBlossomEditorJsRequest(
  request: Request,
  contentType: string,
  assert: AssertFunction
): Promise<Response> {
  if (contentType.includes(CONTENT_TYPE_APPLICATION_JSON)) {
    const payload = (await request.json()) as { imageUrl?: unknown };
    const imageUrl =
      typeof payload.imageUrl === "string" ? payload.imageUrl : "";
    assert(
      imageUrl.startsWith(HTTPS_PREFIX),
      "Blossom EditorJS payload must include a valid image URL",
      { imageUrlType: typeof payload.imageUrl }
    );
    return createEditorJsUrlResponse(imageUrl);
  }

  if (!contentType.includes(CONTENT_TYPE_MULTIPART_FORM_DATA)) {
    throw new ValidationError(
      "Request must be multipart/form-data or JSON when using Blossom for EditorJS uploads",
      { contentType }
    );
  }

  const uploadHandler = composeUploadHandlers(
    createMemoryUploadHandler({
      maxPartSize: EDITORJS_MAX_PART_SIZE,
    })
  );
  const formData = await parseMultipartFormData(request, uploadHandler);
  const imageValue = formData.get("image") ?? formData.get("imageFile");
  assert(imageValue !== null, "No image file provided", {
    formDataKeys: Array.from(formData.keys()),
  });

  if (typeof imageValue === "string" && imageValue.startsWith(HTTPS_PREFIX)) {
    return createEditorJsUrlResponse(imageValue);
  }

  throw new ValidationError(
    "Blossom EditorJS uploads must be uploaded client-side first and submitted as an HTTPS URL."
  );
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const errorHandler = await import("~/lib/error-handler.server");
      const assert: AssertFunction = errorHandler.assert;

      // Ensure user is authenticated
      const userId = await requireUserId(request);

      // Check user's upload provider preference
      const { provider } = await loadUploadProviderSettings(userId);
      const uploadProvider = provider;
      const isBlossomProvider = uploadProvider.includes("BLOSSOM");

      // Blossom path: accept pre-uploaded URL payload to keep EditorJS contract.
      // Binary file uploads to Blossom are handled on the client.
      const contentType = request.headers.get("content-type") ?? "";
      if (isBlossomProvider) {
        return await handleBlossomEditorJsRequest(request, contentType, assert);
      }

      // S3 path for EditorJS
      assert(
        contentType.includes(CONTENT_TYPE_MULTIPART_FORM_DATA),
        "Request must be multipart/form-data",
        { contentType }
      );

      let formData: FormData;
      try {
        const uploadHandler = composeUploadHandlers(
          createMemoryUploadHandler({
            maxPartSize: EDITORJS_MAX_PART_SIZE,
          })
        );
        formData = await parseMultipartFormData(request, uploadHandler);
      } catch (error) {
        throw new ExternalServiceError(
          "Failed to parse multipart form data",
          400,
          {
            originalError:
              error instanceof Error ? error.message : String(error),
          }
        );
      }

      const imageFile = formData.get("image") ?? formData.get("imageFile");
      assert(imageFile !== null, "No image file provided", {
        formDataKeys: Array.from(formData.keys()),
      });

      // Handle File object
      if (imageFile instanceof File) {
        // Validate file type
        assert(imageFile.type.startsWith("image/"), "File must be an image", {
          fileType: imageFile.type,
        });

        // Validate file size (5MB limit)
        assert(
          imageFile.size <= 5 * 1024 * 1024,
          "Image must be smaller than 5MB",
          { fileSize: imageFile.size, maxSize: 5 * 1024 * 1024 }
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
          throw new ExternalServiceError("Failed to process image", 500, {
            service: "ImageProcessing",
            originalError:
              error instanceof Error ? error.message : String(error),
          });
        }

        // Upload to S3 using EditorJS-specific function
        let imageUrl: string;
        try {
          imageUrl = await uploadEditorJSImage(
            processedBuffer,
            userId,
            imageFile.name
          );
        } catch (error) {
          throw new ExternalServiceError(
            "Failed to upload image to storage",
            500,
            {
              service: "S3",
              fileName: imageFile.name,
              originalError:
                error instanceof Error ? error.message : String(error),
            }
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
      if (typeof imageFile === "string" && imageFile.startsWith(HTTPS_PREFIX)) {
        return createEditorJsUrlResponse(imageFile);
      }

      // Check if it's a File object
      // typeof null === "object" in JavaScript, but we've already asserted imageFile !== null above
      const isFile =
        typeof imageFile === "object" &&
        "name" in imageFile &&
        "size" in imageFile;
      throw new ValidationError("Invalid file format", {
        fileType: typeof imageFile,
        isFile,
      });
    } catch (error) {
      // If error is a Response (e.g., redirect from requireUserId), return it
      if (error instanceof Response) {
        return error;
      }
      // Use dynamic import to avoid bundling issues
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "EditorJS Image Upload API" });
}
