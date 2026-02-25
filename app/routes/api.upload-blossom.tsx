import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  createMediaIfMissing,
  recordBlossomCompatUsage,
} from "~/features/upload";
import { loadUploadProviderSettings } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError, AuthorizationError } from "~/lib/errors";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

interface ParsedUploadTags {
  url: string;
  sha256: string;
  size: number;
  mimeType: string;
}

function normalizeTags(payload: unknown): string[][] {
  const candidate = payload as { tags?: unknown };
  if (Array.isArray(candidate.tags)) return candidate.tags as string[][];
  if (Array.isArray(payload)) return payload as string[][];
  return [];
}

function parseUploadTags(
  tags: string[][],
  assert: AssertFunction
): ParsedUploadTags {
  const urlTag = tags.find(
    (tag: string[]) => Array.isArray(tag) && tag[0] === "url"
  );
  const hashTag = tags.find(
    (tag: string[]) => Array.isArray(tag) && (tag[0] === "x" || tag[0] === "ox")
  );
  const sizeTag = tags.find(
    (tag: string[]) => Array.isArray(tag) && tag[0] === "size"
  );
  const mimeTypeTag = tags.find(
    (tag: string[]) => Array.isArray(tag) && tag[0] === "m"
  );

  assert(
    !!(urlTag && hashTag && sizeTag && urlTag[1] && hashTag[1] && sizeTag[1]),
    "Invalid Blossom upload data - missing required tags (url, x/ox, size)",
    {
      hasUrlTag: !!urlTag,
      hasHashTag: !!hashTag,
      hasSizeTag: !!sizeTag,
      tagsCount: tags.length,
    }
  );

  const size = parseInt(sizeTag[1], 10);
  return {
    url: urlTag[1],
    sha256: hashTag[1],
    size,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Ternary preserves empty strings; ?? would incorrectly treat "" as falsy
    mimeType: mimeTypeTag?.[1] ? mimeTypeTag[1] : "application/octet-stream",
  };
}

async function persistMirrorMetadata(
  userId: string,
  mirrors: unknown,
  fallback: ParsedUploadTags
): Promise<void> {
  const mirrorEntries = Array.isArray(mirrors) ? mirrors : [];
  for (const mirrorEntry of mirrorEntries) {
    if (!mirrorEntry || typeof mirrorEntry !== "object") continue;
    const mirrorObj = mirrorEntry as Record<string, unknown>;
    if (mirrorObj["success"] !== true) continue;
    const mirrorUrl =
      typeof mirrorObj["url"] === "string" ? mirrorObj["url"] : "";
    if (!mirrorUrl) continue;
    const mirrorSha256 =
      typeof mirrorObj["sha256"] === "string"
        ? mirrorObj["sha256"]
        : fallback.sha256;
    const mirrorMimeType =
      typeof mirrorObj["type"] === "string"
        ? mirrorObj["type"]
        : fallback.mimeType;
    const mirrorSizeRaw = mirrorObj["size"];
    const mirrorSize =
      typeof mirrorSizeRaw === "number" && Number.isFinite(mirrorSizeRaw)
        ? mirrorSizeRaw
        : fallback.size;
    const mirrorProvider =
      typeof mirrorObj["provider"] === "string"
        ? mirrorObj["provider"]
        : "BLOSSOM_MIRROR";

    const persisted = await createMediaIfMissing({
      userId,
      url: mirrorUrl,
      sha256: mirrorSha256,
      size: Number.isNaN(mirrorSize) ? null : mirrorSize,
      mimeType: mirrorMimeType,
      provider: mirrorProvider,
    });
    if (
      persisted.created &&
      mirrorProvider !== "BLOSSOM_SFS" &&
      !Number.isNaN(mirrorSize) &&
      mirrorSize > 0
    ) {
      await recordBlossomCompatUsage(userId, mirrorSize);
    }
  }
}

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
      let data: { tags?: unknown; fileName?: string; mirrors?: unknown };
      try {
        data = (await request.json()) as {
          tags?: unknown;
          fileName?: string;
          mirrors?: unknown;
        };
      } catch (error) {
        throw new ValidationError("Invalid JSON in request body", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }

      const tags = normalizeTags(data);

      assert(
        Array.isArray(tags) && tags.length > 0,
        "Invalid Blossom upload data - tags must be an array",
        { tagsType: typeof tags, isArray: Array.isArray(tags) }
      );

      const parsedTags = parseUploadTags(tags, assert);
      const fileUrl = parsedTags.url;
      const sha256 = parsedTags.sha256;
      const fileSize = parsedTags.size;
      const mimeType = parsedTags.mimeType;

      // Persist media metadata for both lanes:
      // - BLOSSOM_SFS remains authoritative via commit-batch.
      // - Other Blossom providers are treated as compatibility metadata.
      const persisted = await createMediaIfMissing({
        userId,
        url: fileUrl,
        sha256,
        size: Number.isNaN(fileSize) ? null : fileSize,
        mimeType,
        provider: uploadProvider,
      });
      if (
        persisted.created &&
        uploadProvider !== "BLOSSOM_SFS" &&
        !Number.isNaN(fileSize) &&
        fileSize > 0
      ) {
        await recordBlossomCompatUsage(userId, fileSize);
      }

      await persistMirrorMetadata(userId, data.mirrors, parsedTags);

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
