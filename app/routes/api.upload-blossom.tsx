import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { loadUploadProviderSettings } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError, AuthorizationError } from "~/lib/errors";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const errorHandler = await import("~/lib/error-handler.server");
      const assert: AssertFunction = errorHandler.assert;
      const { createSuccessResponse } = errorHandler;

      // Ensure user is authenticated
      const userId = await requireUserId(request);

      // Check if user has any Blossom provider as their preferred upload provider
      const { provider } = await loadUploadProviderSettings(userId);
      const uploadProvider = provider;
      if (!uploadProvider.includes("BLOSSOM")) {
        throw new AuthorizationError(
          "Blossom uploads not enabled for this user",
          {
            userId,
            uploadProvider,
          }
        );
      }

      // Parse the incoming data from client-side Blossom upload
      let data: { tags?: unknown; fileName?: string };
      try {
        data = (await request.json()) as { tags?: unknown; fileName?: string };
      } catch (error) {
        throw new ValidationError("Invalid JSON in request body", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }

      // The BlossomUploader returns the tags array directly, not wrapped in an object
      const tags = (
        Array.isArray(data.tags) ? data.tags : Array.isArray(data) ? data : []
      ) as string[][];

      assert(
        Array.isArray(tags) && tags.length > 0,
        "Invalid Blossom upload data - tags must be an array",
        { tagsType: typeof tags, isArray: Array.isArray(tags) }
      );

      // Extract relevant information from the Blossom tags
      // Expected format: [['url', 'https://...'], ['x', 'hash'], ['size', '123'], ['m', 'image/jpeg']]
      const urlTag = tags.find(
        (tag: string[]) => Array.isArray(tag) && tag[0] === "url"
      );
      const hashTag = tags.find(
        (tag: string[]) =>
          Array.isArray(tag) && (tag[0] === "x" || tag[0] === "ox")
      );
      const sizeTag = tags.find(
        (tag: string[]) => Array.isArray(tag) && tag[0] === "size"
      );
      const mimeTypeTag = tags.find(
        (tag: string[]) => Array.isArray(tag) && tag[0] === "m"
      );

      assert(
        !!(
          urlTag &&
          hashTag &&
          sizeTag &&
          urlTag[1] &&
          hashTag[1] &&
          sizeTag[1]
        ),
        "Invalid Blossom upload data - missing required tags (url, x/ox, size)",
        {
          hasUrlTag: !!urlTag,
          hasHashTag: !!hashTag,
          hasSizeTag: !!sizeTag,
          tagsCount: tags.length,
        }
      );

      const fileUrl = urlTag[1];
      const sha256 = hashTag[1];
      const fileSize = parseInt(sizeTag[1], 10);
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Ternary preserves empty strings; ?? would incorrectly treat "" as falsy
      const mimeType = mimeTypeTag?.[1]
        ? mimeTypeTag[1]
        : "application/octet-stream";

      // Return success response with processed data
      // This matches the S3 upload response format for compatibility
      return createSuccessResponse({
        file: {
          url: fileUrl,
          size: fileSize,
          name: data.fileName ?? `blossom-${sha256.substring(0, 8)}`,
          extension: data.fileName ? data.fileName.split(".").pop() : "bin",
          sha256,
          mimeType,
          provider: uploadProvider,
        },
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
  return json({ message: "Blossom Upload API" });
}
