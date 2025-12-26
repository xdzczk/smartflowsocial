import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { loadUploadProviderSettings } from "~/features/user/services/upload-provider.server";
import {
  ValidationError,
  AuthorizationError,
} from "~/lib/errors";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    // Ensure user is authenticated
    const userId = await requireUserId(request);

    // Check if user has any Blossom provider as their preferred upload provider
    const { provider } = await loadUploadProviderSettings(userId);
    const uploadProvider = provider;
    if (!uploadProvider.includes("BLOSSOM")) {
      throw new AuthorizationError("Blossom uploads not enabled for this user", {
        userId,
        uploadProvider,
      });
    }

    // Parse the incoming data from client-side Blossom upload
    let data: { tags?: unknown; fileName?: string };
    try {
      data = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    // The BlossomUploader returns the tags array directly, not wrapped in an object
    const tags = data.tags || data;

    assert(
      Array.isArray(tags),
      "Invalid Blossom upload data - tags must be an array",
      { tagsType: typeof tags, isArray: Array.isArray(tags) },
    );

    // Extract relevant information from the Blossom tags
    // Expected format: [['url', 'https://...'], ['x', 'hash'], ['size', '123'], ['m', 'image/jpeg']]
    const urlTag = tags.find((tag: string[]) => tag[0] === "url");
    const hashTag = tags.find(
      (tag: string[]) => tag[0] === "x" || tag[0] === "ox",
    );
    const sizeTag = tags.find((tag: string[]) => tag[0] === "size");
    const mimeTypeTag = tags.find((tag: string[]) => tag[0] === "m");

    assert(
      urlTag && hashTag && sizeTag,
      "Invalid Blossom upload data - missing required tags (url, x/ox, size)",
      {
        hasUrlTag: !!urlTag,
        hasHashTag: !!hashTag,
        hasSizeTag: !!sizeTag,
        tagsCount: tags.length,
      },
    );

    const fileUrl = urlTag[1] as string;
    const sha256 = hashTag[1] as string;
    const fileSize = parseInt(sizeTag[1] as string, 10);
    const mimeType = mimeTypeTag
      ? (mimeTypeTag[1] as string)
      : "application/octet-stream";

    // Return success response with processed data
    // This matches the S3 upload response format for compatibility
    return createSuccessResponse({
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
  },
);

// Handle preflight requests for CORS
export async function loader() {
  return json({ message: "Blossom Upload API" });
}
