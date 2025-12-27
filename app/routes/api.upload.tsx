import type { ActionFunctionArgs } from "@remix-run/node";
import { json ,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { createUploadHandler } from "~/features/upload/s3.server";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";
import {
  ExternalServiceError,
} from "~/lib/errors";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    // Ensure user is authenticated
    const userId = await requireUserId(request);

    // Validate content type
    const contentType = request.headers.get("content-type") || "";
    assert(
      contentType.includes("multipart/form-data"),
      "Request must be multipart/form-data",
      { contentType },
    );

    // Parse the multipart form data using the general upload handler
    let formData: FormData;
    try {
      const uploadHandler = composeUploadHandlers(
        createUploadHandler(userId),
        createMemoryUploadHandler({
          maxPartSize: 100 * 1024 * 1024, // 100MB max for videos
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
      },
    );

    return createSuccessResponse({ fileUrl: file });
  },
);

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "General File Upload API" });
}
