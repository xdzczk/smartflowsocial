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

      // #region agent log
      await fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "api.upload-blossom.tsx:17",
            message: "Upload-blossom action started",
            data: { method: request.method },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "C",
          }),
        }
      ).catch(() => {});
      // #endregion

      // Ensure user is authenticated
      const userId = await requireUserId(request);
      // #region agent log
      await fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "api.upload-blossom.tsx:24",
            message: "User authenticated",
            data: { userId },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "C",
          }),
        }
      ).catch(() => {});
      // #endregion

      // Check if user has any Blossom provider as their preferred upload provider
      const { provider } = await loadUploadProviderSettings(userId);
      const uploadProvider = provider;
      // #region agent log
      await fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "api.upload-blossom.tsx:27",
            message: "Upload provider checked",
            data: {
              uploadProvider,
              includesBlossom: uploadProvider.includes("BLOSSOM"),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "C",
          }),
        }
      ).catch(() => {});
      // #endregion
      if (!uploadProvider.includes("BLOSSOM")) {
        // #region agent log
        await fetch(
          "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "api.upload-blossom.tsx:29",
              message: "Blossom not enabled for user",
              data: { uploadProvider },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "C",
            }),
          }
        ).catch(() => {});
        // #endregion
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
        // #region agent log
        await fetch(
          "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "api.upload-blossom.tsx:42",
              message: "Request body parsed",
              data: {
                hasTags: !!data.tags,
                hasFileName: !!data.fileName,
                tagsIsArray: Array.isArray(data.tags),
                tagsLength: Array.isArray(data.tags) ? data.tags.length : 0,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "B",
            }),
          }
        ).catch(() => {});
        // #endregion
      } catch (error) {
        // #region agent log
        await fetch(
          "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "api.upload-blossom.tsx:45",
              message: "JSON parse error",
              data: {
                error: error instanceof Error ? error.message : String(error),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "B",
            }),
          }
        ).catch(() => {});
        // #endregion
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

      // #region agent log
      await fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "api.upload-blossom.tsx:95",
            message: "Tags extracted successfully",
            data: { fileUrl, sha256, fileSize, mimeType },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "A",
          }),
        }
      ).catch(() => {});
      // #endregion

      // Return success response with processed data
      // This matches the S3 upload response format for compatibility
      const responseData = {
        file: {
          url: fileUrl,
          size: fileSize,
          name: data.fileName ?? `blossom-${sha256.substring(0, 8)}`,
          extension: data.fileName ? data.fileName.split(".").pop() : "bin",
          sha256,
          mimeType,
          provider: uploadProvider,
        },
      };
      // #region agent log
      await fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "api.upload-blossom.tsx:113",
            message: "Returning success response",
            data: {
              responseStructure: JSON.stringify({
                success: true,
                data: responseData,
              }),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "D",
          }),
        }
      ).catch(() => {});
      // #endregion
      return createSuccessResponse(responseData);
    } catch (error) {
      // #region agent log
      await fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "api.upload-blossom.tsx:115",
            message: "Exception caught in action",
            data: {
              errorMessage:
                error instanceof Error ? error.message : String(error),
              errorType: error?.constructor?.name,
              isResponse: error instanceof Response,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "E",
          }),
        }
      ).catch(() => {});
      // #endregion
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
