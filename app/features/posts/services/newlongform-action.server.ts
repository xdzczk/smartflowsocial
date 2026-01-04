/**
 * New longform action handlers
 * Centralized action processing for new longform post page
 */

import {
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import {
  createUploadHandler,
  uploadBufferToS3,
} from "~/features/upload/s3.server";
import {
  getUserById,
  getQueueTypes,
  getHashTagPresetById,
} from "~/features/user";
import { env } from "~/lib/env.server";
import { fetchWithRetry } from "~/lib/fetch.server";
import {
  sanitizeMarkdown,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";
import {
  newLongformPostActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { createLongFormPost } from "~/models/longformpost.server";

import { convertEditorJSToMarkdown } from "../longform.server";

import { resolveQueueTypeId } from "./queue-type-resolver.server";

/**
 * Parse and combine tags from form data
 */
function parseTags(formData: FormData): string[] {
  const tags =
    formData
      .get("tags")
      ?.toString()
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? [];

  const customTags = formData.get("customTags")?.toString() ?? "";

  // If there are custom tags input separately, parse and combine them
  if (customTags) {
    const customTagsList = customTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // Add custom tags to the existing tags array and deduplicate
    const allTags = [...tags, ...customTagsList];
    const uniqueTags = allTags.filter(
      (tag, index) =>
        allTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) ===
        index,
    );
    return uniqueTags;
  }

  return tags;
}

/**
 * Get hashtag preset tags based on user selection and queue type
 */
async function getHashtagPresetTags(
  userId: string,
  useHashtagPresets: boolean,
  manualHashTagPresetId: string | null,
  queueType: string,
): Promise<{ tags: string; presetId: string | null }> {
  let hashTagPresetTags = "";
  let hashTagPresetId = null;

  if (useHashtagPresets) {
    // Manual hashtag presets are enabled
    if (manualHashTagPresetId) {
      // Use manually selected hashtag preset
      const preset = await getHashTagPresetById(userId, manualHashTagPresetId);
      hashTagPresetTags = preset?.tags ?? "";
      hashTagPresetId = manualHashTagPresetId;
    }
    // If useHashtagPresets is true but no manual preset selected, use no hashtags
    // This ensures manual hashtag preset selection overrides queue defaults
  } else {
    // Manual hashtag presets are disabled, use queue type's default hashtag preset
    if (queueType !== "Unassigned") {
      const queueTypes = await getQueueTypes(userId);
      const selectedQueueType = queueTypes.find((qt) => qt.name === queueType);
      if (
        selectedQueueType &&
        "hashTagPreset" in selectedQueueType &&
        selectedQueueType.hashTagPreset
      ) {
        const preset = selectedQueueType.hashTagPreset;
        if (
          preset &&
          typeof preset === "object" &&
          "tags" in preset &&
          typeof preset.tags === "string"
        ) {
          hashTagPresetTags = preset.tags ?? "";
        }
        if (
          preset &&
          typeof preset === "object" &&
          "id" in preset &&
          typeof preset.id === "string"
        ) {
          hashTagPresetId = preset.id;
        }
      }
    }
  }

  return { tags: hashTagPresetTags, presetId: hashTagPresetId };
}

/**
 * Handle image upload action
 */
async function handleImageUpload(
  userId: string,
  formData: FormData,
): Promise<Response> {
  const imageFileRaw = formData.get("imageFile");
  const imageFile = imageFileRaw;

  // If it's already a URL string, return it
  if (
    imageFile &&
    typeof imageFile === "string" &&
    imageFile.startsWith("https://")
  ) {
    return Response.json({ success: true, imageUrl: imageFile });
  }

  // If it's a File object, process it using S3 upload
  // (Blossom uploads are handled client-side)
  if (
    imageFile &&
    typeof imageFile === "object" &&
    imageFile.constructor.name === "File"
  ) {
    try {
      const file = imageFile;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // Pass contentType for validation
      const imageUrl = await uploadBufferToS3(
        buffer,
        userId,
        file.name,
        undefined,
        file.type,
      );
      return Response.json({ success: true, imageUrl });
    } catch (error) {
      const { ExternalServiceError } = await import("~/lib/errors");
      const { handleActionError } = await import("~/lib/error-handler.server");
      const uploadError = new ExternalServiceError(
        "Failed to upload image to storage",
        500,
        {
          service: "S3",
          fileName: imageFile.name,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
      return handleActionError(uploadError);
    }
  }

  if (!imageFile) {
    return Response.json(
      { success: false, error: "No image file provided." },
      { status: 400 },
    );
  } else {
    return Response.json(
      {
        success: false,
        error: "Image upload failed. Please try again.",
      },
      { status: 400 },
    );
  }
}

/**
 * Handle save draft action
 */
async function handleSaveDraft(
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null,
): Promise<Response> {
  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);

  // Resolve queue type ID in feature layer (business logic)
  const queueTypeId = await resolveQueueTypeId(
    userId,
    null,
    queueType === "Unassigned" ? null : queueType,
  );

  if (!title.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  let markdownContent;
  try {
    const editorData = JSON.parse(editorContent) as {
      blocks?: { type: string; data: Record<string, unknown> }[];
      time?: number;
      version?: string;
    };
    markdownContent = convertEditorJSToMarkdown({
      blocks: editorData.blocks ?? [],
      time: editorData.time,
      version: editorData.version,
    });
  } catch {
    markdownContent = editorContent;
  }

  const sanitizedContent = sanitizeMarkdown(markdownContent);
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  await createLongFormPost({
    userId,
    title,
    summary: finalSummary,
    content: sanitizedContent, // Save as markdown for consistency
    image,
    tags,
    isPublished: false,
    queueTypeId,
    hashTagPresetId,
  });

  return redirect("/dashboard/drafts?tab=longform");
}

/**
 * Handle publish action
 */
async function handlePublish(
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
  sanitizedRelays: string[],
): Promise<Response> {
  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);
  const signedEvent = formData.get("signedEvent");
  const nostrEvent = formData.get("nostrEvent");

  // Resolve queue type ID in feature layer (business logic)
  const queueTypeId = await resolveQueueTypeId(
    userId,
    null,
    queueType === "Unassigned" ? null : queueType,
  );

  if (!title.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  if (!summary?.trim()) {
    return Response.json(
      { error: "Summary is required for publishing" },
      { status: 400 },
    );
  }

  if (!image?.trim()) {
    return Response.json(
      { error: "Cover image is required for publishing" },
      { status: 400 },
    );
  }

  if (!signedEvent || !nostrEvent) {
    return Response.json(
      { error: "Missing Nostr event data for publishing" },
      { status: 400 },
    );
  }

  let markdownContent;
  try {
    const editorData = JSON.parse(editorContent) as {
      blocks?: { type: string; data: Record<string, unknown> }[];
      time?: number;
      version?: string;
    };
    markdownContent = convertEditorJSToMarkdown({
      blocks: editorData.blocks ?? [],
      time: editorData.time,
      version: editorData.version,
    });
  } catch {
    markdownContent = editorContent;
  }

  const sanitizedContent = sanitizeMarkdown(markdownContent);
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  // Add hashtags to content if user has enabled it
  const contentWithHashtags =
    showHashTagsinPosts && hashTagPresetTags
      ? `${sanitizedContent}\\n\\n${hashTagPresetTags}`
      : sanitizedContent;

  const signedEventJson = JSON.parse(signedEvent.toString()) as {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
    sig: string;
  };
  const nostrEventJson = JSON.parse(nostrEvent.toString()) as {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
  };

  await createLongFormPost({
    userId,
    title,
    summary: finalSummary,
    content: contentWithHashtags,
    image,
    tags,
    isPublished: true,
    signedEvent: signedEventJson,
    nostrEvent: nostrEventJson,
    queueTypeId,
    hashTagPresetId,
  });

  // Read directly from process.env to support test environment changes
  const publisherUrl =
    process.env.NOSTR_PUBLISHER_URL ?? env.NOSTR_PUBLISHER_URL;
  if (!publisherUrl) {
    throw new Error("NOSTR_PUBLISHER_URL environment variable is not set");
  }
  const response = await fetchWithRetry(publisherUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      relays: sanitizedRelays,
      event: signedEventJson,
    }),
    timeout: 15000, // 15 seconds for publishing
    maxRetries: 2,
  });

  if (!response.ok) {
    throw new Error(`Failed to publish to nostr: ${response.statusText}`);
  }

  return redirect("/dashboard/posted?tab=longform");
}

/**
 * Handle schedule longform action
 */
async function handleScheduleLongform(
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null,
  hashTagPresetTags: string,
  showHashTagsinPosts: boolean,
): Promise<Response> {
  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);
  const signedEvent = formData.get("signedEvent");
  const nostrEvent = formData.get("nostrEvent");

  // Resolve queue type ID in feature layer (business logic)
  const queueTypeId = await resolveQueueTypeId(
    userId,
    null,
    queueType === "Unassigned" ? null : queueType,
  );

  if (!title.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  if (!summary?.trim()) {
    return Response.json(
      { error: "Summary is required for publishing" },
      { status: 400 },
    );
  }

  if (!image?.trim()) {
    return Response.json(
      { error: "Cover image is required for publishing" },
      { status: 400 },
    );
  }

  if (!signedEvent || !nostrEvent) {
    return Response.json(
      { error: "Missing Nostr event data for publishing" },
      { status: 400 },
    );
  }

  let markdownContent;
  try {
    const editorData = JSON.parse(editorContent) as {
      blocks?: { type: string; data: Record<string, unknown> }[];
      time?: number;
      version?: string;
    };
    markdownContent = convertEditorJSToMarkdown({
      blocks: editorData.blocks ?? [],
      time: editorData.time,
      version: editorData.version,
    });
  } catch {
    markdownContent = editorContent;
  }

  const sanitizedContent = sanitizeMarkdown(markdownContent);
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  // Add hashtags to content if user has enabled it
  const contentWithHashtags =
    showHashTagsinPosts && hashTagPresetTags
      ? `${sanitizedContent}\\n\\n${hashTagPresetTags}`
      : sanitizedContent;

  const signedEventJson = JSON.parse(signedEvent.toString()) as {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
    sig: string;
  };
  const nostrEventJson = JSON.parse(nostrEvent.toString()) as {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
  };

  // Extract published_at from NOSTR event tags for scheduling
  let scheduledForTimestamp: string | null = null;

  if (signedEventJson?.tags) {
    const publishedAtTag = signedEventJson.tags.find(
      (tag: unknown) => Array.isArray(tag) && tag[0] === "published_at",
    );
    if (publishedAtTag?.[1]) {
      scheduledForTimestamp = publishedAtTag[1].toString();
    }
  }

  await createLongFormPost({
    userId,
    title,
    summary: finalSummary,
    content: contentWithHashtags,
    image,
    tags,
    isPublished: false,
    signedEvent: signedEventJson,
    nostrEvent: nostrEventJson,
    scheduledFor: scheduledForTimestamp,
    queueTypeId,
    hashTagPresetId,
  });

  return redirect("/dashboard/scheduled?tab=longform");
}

/**
 * Main action handler for new longform post page
 */
export async function handleNewLongFormAction(
  userId: string,
  request: Request,
): Promise<Response> {
  const user = await getUserById(userId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  const { userRelays, showHashTagsinPosts } = user;
  const sanitizedRelays = userRelays.map((relay: string) => relay.trim());

  const contentType = request.headers.get("Content-Type") ?? "";
  let formData: FormData;

  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = composeUploadHandlers(
      createUploadHandler(userId),
      createMemoryUploadHandler(),
    );
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  // Check for upload-image action first (handled separately)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";
  
  if (_action === "upload-image") {
    return handleImageUpload(userId, formData);
  }

  // Validate non-file fields with Zod
  const result = validateFormDataOrRespond(
    formData,
    newLongformPostActionSchema,
  );
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;
  
  // Type narrowing: exclude upload-image action (already handled above)
  if (validatedData._action === "upload-image") {
    // This shouldn't happen as we handle it above, but TypeScript needs it
    return handleImageUpload(userId, formData);
  }
  
  const queueType = validatedData.queueType || "Unassigned";
  const useHashtagPresets = validatedData.useHashtagPresets ?? false;
  const manualHashTagPresetId: string | null = useHashtagPresets
    ? (validatedData.hashTagPresetId ?? null)
    : null;

  // Get hashtag preset tags
  const { tags: hashTagPresetTags, presetId: hashTagPresetId } =
    await getHashtagPresetTags(
      userId,
      useHashtagPresets,
      manualHashTagPresetId,
      queueType,
    );

  // Ensure hashTagPresetId is string | null (not undefined)
  const finalHashTagPresetId: string | null = hashTagPresetId ?? null;

  // Handle different actions
  if (_action === "save-draft") {
    return handleSaveDraft(userId, formData, queueType, finalHashTagPresetId);
  }

  if (_action === "publish") {
    return handlePublish(
      userId,
      formData,
      queueType,
      finalHashTagPresetId,
      hashTagPresetTags,
      showHashTagsinPosts,
      sanitizedRelays,
    );
  }

  if (_action === "schedule-longform") {
    return handleScheduleLongform(
      userId,
      formData,
      queueType,
      finalHashTagPresetId,
      hashTagPresetTags,
      showHashTagsinPosts,
    );
  }

  return Response.json({ success: false });
}
