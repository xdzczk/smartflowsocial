import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getUserUploadProvider } from "~/models/user.server";

export async function action({ request }: ActionFunctionArgs) {

  try {
    // Ensure user is authenticated
    const userId = await requireUserId(request);

    // Check if user has any Blossom provider as their preferred upload provider
    const uploadProvider = await getUserUploadProvider(userId);
    if (!uploadProvider.includes("BLOSSOM")) {
      return json(
        {
          success: false,
          error: "Blossom uploads not enabled for this user",
        },
        { status: 403 },
      );
    }

    // Parse the incoming data from client-side Blossom upload
    const data = await request.json();

    // The BlossomUploader returns the tags array directly, not wrapped in an object
    const tags = data.tags || data;

    if (!Array.isArray(tags)) {
      return json(
        {
          success: false,
          error: "Invalid Blossom upload data - tags must be an array",
        },
        { status: 400 },
      );
    }

    // Extract relevant information from the Blossom tags
    // Expected format: [['url', 'https://...'], ['x', 'hash'], ['size', '123'], ['m', 'image/jpeg']]
    const urlTag = tags.find((tag: string[]) => tag[0] === "url");
    const hashTag = tags.find(
      (tag: string[]) => tag[0] === "x" || tag[0] === "ox",
    );
    const sizeTag = tags.find((tag: string[]) => tag[0] === "size");
    const mimeTypeTag = tags.find((tag: string[]) => tag[0] === "m");

    if (!urlTag || !hashTag || !sizeTag) {
      return json(
        {
          success: false,
          error:
            "Invalid Blossom upload data - missing required tags (url, x/ox, size)",
        },
        { status: 400 },
      );
    }

    const fileUrl = urlTag[1];
    const sha256 = hashTag[1];
    const fileSize = parseInt(sizeTag[1], 10);
    const mimeType = mimeTypeTag ? mimeTypeTag[1] : "application/octet-stream";


    // Return success response with processed data
    // This matches the S3 upload response format for compatibility
    return json({
      success: true,
      file: {
        url: fileUrl,
        size: fileSize,
        name: data.fileName || `blossom-${sha256.substring(0, 8)}`,
        extension: data.fileName ? data.fileName.split(".").pop() : "bin",
        sha256,
        mimeType,
        provider: uploadProvider,
      },
    });
  } catch (error) {
    console.error("Blossom upload API error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });

    return json(
      {
        success: false,
        error: `API Error: ${error.message || "Upload processing failed"}`,
      },
      { status: 500 },
    );
  }
}

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "Blossom Upload API" });
}
