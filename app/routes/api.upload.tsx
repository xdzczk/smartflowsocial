import type { ActionFunctionArgs } from "@remix-run/node";
import {
  json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { createUploadHandler } from "~/features/upload/s3.server";
import { loadUploadProviderSettings } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { env } from "~/lib/env.server";
import { logWarning } from "~/lib/error-logger.server";
import { ExternalServiceError } from "~/lib/errors";

const CONTENT_TYPE_MULTIPART_FORM_DATA = "multipart/form-data";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

function isS3Configured(): boolean {
  return !!(
    env.STORAGE_REGION?.trim() &&
    env.STORAGE_BUCKET?.trim() &&
    env.STORAGE_ACCESS_KEY?.trim() &&
    env.STORAGE_SECRET?.trim()
  );
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const errorHandler = await import("~/lib/error-handler.server");
      const assert: AssertFunction = errorHandler.assert;
      const { createSuccessResponse } = errorHandler;

      // Ensure user is authenticated
      const userId = await requireUserId(request);

      // If user's upload provider is Blossom, they should use /api/upload-blossom (client sends JSON, not multipart)
      const { provider } = await loadUploadProviderSettings(userId);
      if (
        provider === "BLOSSOM_PRIMAL" ||
        provider === "BLOSSOM_BLOSSTR" ||
        provider === "BLOSSOM_SFS" ||
        provider === "BLOSSOM_CUSTOM"
      ) {
        const { createErrorResponse } =
          await import("~/lib/error-handler.server");
        const [errorResponse] = createErrorResponse(
          new Error(
            "Upload provider is set to Blossom. Use Blossom upload (refresh the page if bulk upload still calls S3)."
          )
        );
        return json(errorResponse, { status: 400 });
      }

      // S3 path: require S3 env vars so we fail fast with a clear message instead of "Region is missing"
      if (!isS3Configured()) {
        const { createErrorResponse } =
          await import("~/lib/error-handler.server");
        const [errorResponse] = createErrorResponse(
          new Error(
            "S3 storage is not configured. Set STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY, and STORAGE_SECRET in your .env, or switch to Primal Blossom in Settings."
          )
        );
        return json(errorResponse, { status: 503 });
      }

      logWarning("Deprecated S3 upload endpoint used", {
        userId,
        route: "/api/upload",
        uploadProvider: provider,
      });

      // Validate content type
      const contentType = request.headers.get("content-type") ?? "";
      assert(
        contentType.includes(CONTENT_TYPE_MULTIPART_FORM_DATA),
        "Request must be multipart/form-data",
        { contentType }
      );

      // Parse the multipart form data using the general upload handler
      let formData: FormData;
      try {
        const uploadHandler = composeUploadHandlers(
          createUploadHandler(userId),
          createMemoryUploadHandler({
            maxPartSize: 100 * 1024 * 1024, // 100MB max for videos
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

      // Validate file exists
      const file = formData.get("file");
      assert(file !== null, "No file provided", {
        formDataKeys: Array.from(formData.keys()),
      });

      // Validate file was processed correctly
      assert(
        typeof file === "string" && file.startsWith("https://"),
        "File upload failed - no URL returned",
        {
          fileType: typeof file,
          fileValue:
            typeof file === "string" ? file.substring(0, 50) : "not a string",
        }
      );

      return createSuccessResponse({ fileUrl: file });
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
  return json({ message: "General File Upload API" });
}
