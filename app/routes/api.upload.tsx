import {
  json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { createUploadHandler } from "~/features/upload/s3.server";

export async function action({ request }) {

  try {
    // Ensure user is authenticated
    const userId = await requireUserId(request);

    // Check content type
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      console.error("Invalid content type:", contentType);
      return json(
        {
          success: false,
          error: "Request must be multipart/form-data",
        },
        { status: 400 },
      );
    }

    // Parse the multipart form data using the general upload handler
    const uploadHandler = composeUploadHandlers(
      createUploadHandler(userId),
      createMemoryUploadHandler({
        maxPartSize: 100 * 1024 * 1024, // 100MB max for videos
      }),
    );
    const formData = await parseMultipartFormData(request, uploadHandler);

    const file = formData.get("file");

    if (!file) {
      console.error("No file in form data");
      return json(
        {
          success: false,
          error: "No file provided",
        },
        { status: 400 },
      );
    }

    // If the upload handler processed the file, it should return a URL string
    if (typeof file === "string" && file.startsWith("https://")) {
      return json({
        success: true,
        fileUrl: file,
      });
    }

    // If we get here, the file wasn't processed properly
    console.error("File upload failed - no URL returned");
    return json(
      {
        success: false,
        error: "File upload failed",
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("General upload API error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });

    return json(
      {
        success: false,
        error: `API Error: ${error.message || "Upload failed"}`,
      },
      { status: 500 },
    );
  }
}

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "General File Upload API" });
}
