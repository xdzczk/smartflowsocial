/**
 * Longform edit action handlers
 * Centralized action processing for longform edit page
 */

import {
  json,
  redirect,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { updateLongFormPost } from "~/features/posts/server";
import {
  createLongformDraftVersion,
  LONGFORM_SNAPSHOT_SCHEMA_VERSION,
} from "~/features/posts/server/drafts";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { uploadBufferToS3 } from "~/features/upload/s3.server";
import {
  getUserById,
  getHashTagPresetById,
  getQueueTypeByNameForUser,
  getQueueTypes,
} from "~/features/user";
import {
  extractCorrelationId,
  getCorrelationId,
} from "~/lib/correlation-context.server";
import { logError, logWarning } from "~/lib/error-logger.server";
import {
  sanitizeMarkdown,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import {
  newLongformPostActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { LongFormPostStateMachine } from "../state-machine/longform-post-state-machine.server";
import { PublishLongFormNowUseCase } from "../use-cases/publish-longform-now.use-case.server";
import { ScheduleLongFormPostUseCase } from "../use-cases/schedule-longform-post.use-case.server";

const ERROR_TITLE_REQUIRED = "Title is required";
const ERROR_CONTENT_REQUIRED = "Content is required";

/**
 * Parse and combine tags from form data
 */
function parseTags(formData: FormData): string[] {
  const tagsRaw = formData.get("tags");
  const tagsStr = typeof tagsRaw === "string" ? tagsRaw : "";
  const tags = tagsStr
    .split(",")
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  const customTagsRaw = formData.get("customTags");
  const customTags = typeof customTagsRaw === "string" ? customTagsRaw : "";

  // If there are custom tags input separately, parse and combine them
  if (customTags) {
    const customTagsList = customTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // Add custom tags to the existing tags array and deduplicate
    const allTags: string[] = [...tags, ...customTagsList];
    return allTags.filter(
      (tag: string, index: number) =>
        allTags.findIndex(
          (t: string) => t.toLowerCase() === tag.toLowerCase()
        ) === index
    );
  }

  return tags;
}

/**
 * Get effective hashtags based on user preferences
 */
async function getEffectiveHashtagsForPost(
  userId: string,
  useHashtagPresets: boolean,
  hashTagPresetId: string | null,
  queueType: string
): Promise<string> {
  if (useHashtagPresets) {
    // Manual hashtag presets are enabled
    if (hashTagPresetId) {
      // Use manually selected hashtag preset
      const selectedPreset = await getHashTagPresetById(
        userId,
        hashTagPresetId
      );
      return selectedPreset?.tags ?? "";
    }
    // If useHashtagPresets is true but no manual preset selected, use no hashtags
    // This ensures manual hashtag preset selection overrides queue defaults
    return "";
  } else {
    // Manual hashtag presets are disabled, use queue type's default hashtag preset
    const queueTypes = await getQueueTypes(userId);
    const queueTypeObj = queueTypes.find((qt) => qt.name === queueType);
    if (
      queueTypeObj &&
      "hashTagPreset" in queueTypeObj &&
      queueTypeObj.hashTagPreset
    ) {
      return (queueTypeObj.hashTagPreset as { tags: string | null }).tags ?? "";
    }
    return "";
  }
}

/**
 * Handle image upload action
 */
async function handleImageUpload(
  userId: string,
  formData: FormData
): Promise<Response> {
  const imageFileRaw = formData.get("imageFile");
  const imageFile = imageFileRaw;

  // If it's already a URL string, return it
  if (
    imageFile &&
    typeof imageFile === "string" &&
    imageFile.startsWith("https://")
  ) {
    return json({ success: true, imageUrl: imageFile });
  }

  // If it's a File object, we need to process it manually
  if (
    imageFile &&
    typeof imageFile === "object" &&
    imageFile.constructor.name === "File"
  ) {
    try {
      logWarning("Using temporary longform-edit S3 cover-image fallback", {
        userId,
        action: "longform-edit.upload-image",
        fileName: imageFile.name,
      });
      // Process the file upload using shared S3 function
      const file = imageFile;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Use the shared uploadBufferToS3 function
      // Pass contentType for validation
      const imageUrl = await uploadBufferToS3(
        buffer,
        userId,
        file.name,
        undefined,
        file.type
      );

      return json({ success: true, imageUrl });
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        userId,
        fileName: imageFile.name,
        message: "S3 upload error",
      });
      return json(
        {
          success: false,
          error: "Failed to upload image to storage.",
        },
        { status: 500 }
      );
    }
  }

  if (!imageFile) {
    return json(
      { success: false, error: "No image file provided." },
      { status: 400 }
    );
  } else {
    return json(
      {
        success: false,
        error: "Image upload failed. Please try again.",
      },
      { status: 400 }
    );
  }
}

/**
 * Handle save draft action
 */
async function handleSaveDraft(
  postId: string,
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null
): Promise<Response> {
  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);

  // Get queueTypeId if queueType is provided and not "unassigned"
  let queueTypeId = null;
  if (queueType && queueType !== "unassigned") {
    const queueTypeRecord = await getQueueTypeByNameForUser(userId, queueType);
    queueTypeId = queueTypeRecord?.id ?? null;
  }

  if (!title.trim()) {
    return json({ error: ERROR_TITLE_REQUIRED }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return json({ error: ERROR_CONTENT_REQUIRED }, { status: 400 });
  }

  const markdownContent = editorContent.trim();
  const sanitizedContent = sanitizeMarkdown(markdownContent);
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  await updateLongFormPost({
    id: postId,
    userId,
    title,
    summary: finalSummary,
    content: sanitizedContent,
    image,
    tags,
    queueTypeId,
    hashTagPresetId,
  });

  // Transition to DRAFT state using state machine (flags will be synced automatically)
  const stateMachine = new LongFormPostStateMachine();
  await stateMachine.transition(
    postId,
    userId,
    "DRAFT",
    "Article saved as draft"
  );

  await createLongformDraftVersion(
    postId,
    {
      schemaVersion: LONGFORM_SNAPSHOT_SCHEMA_VERSION,
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- form/editor state can be null */
      title: title ?? null,
      summary: finalSummary ?? null,
      content: sanitizedContent ?? null,
      image: image ?? null,
      tags: tags ?? [],
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      queueTypeId,
    },
    userId
  );

  return redirect("/dashboard/drafts?tab=longform");
}

/**
 * Handle publish action
 */
async function handlePublish(
  postId: string,
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null,
  effectiveHashtags: string,
  showHashTagsinPosts: boolean,
  sanitizedRelays: string[],
  request: Request,
  sessionPubkey: string
): Promise<Response> {
  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);
  const signedEvent = formData.get("signedEvent");
  const nostrEvent = formData.get("nostrEvent");

  // Get queueTypeId if queueType is provided and not "unassigned"
  let queueTypeId = null;
  if (queueType && queueType !== "unassigned") {
    const queueTypeRecord = await getQueueTypeByNameForUser(userId, queueType);
    queueTypeId = queueTypeRecord?.id ?? null;
  }

  if (!title.trim()) {
    return json({ error: ERROR_TITLE_REQUIRED }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return json({ error: ERROR_CONTENT_REQUIRED }, { status: 400 });
  }

  if (!summary?.trim()) {
    return json(
      { error: "Summary is required for publishing" },
      { status: 400 }
    );
  }

  if (!image?.trim()) {
    return json(
      { error: "Cover image is required for publishing" },
      { status: 400 }
    );
  }

  if (!signedEvent || !nostrEvent) {
    return json(
      { error: "Missing Nostr event data for publishing" },
      { status: 400 }
    );
  }

  const markdownContent = editorContent.trim();
  const sanitizedContent = sanitizeMarkdown(markdownContent);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  // Add hashtags to content if user has enabled it
  const contentWithHashtags = showHashTagsinPosts
    ? `${sanitizedContent}\\n\\n${effectiveHashtags}`
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

  assertSignedEventMatchesSessionPubkey({
    sessionPubkey,
    eventPubkey: signedEventJson.pubkey,
    context: { feature: "longform_edit", action: "publish", postId },
  });

  // Update the post first
  // Note: Flag fields (isPublished) have been removed. State machine will handle state transition.
  await updateLongFormPost({
    id: postId,
    userId,
    title,
    summary: finalSummary,
    content: contentWithHashtags,
    image,
    tags,
    signedEvent: signedEventJson,
    nostrEvent: nostrEventJson,
    queueTypeId,
    hashTagPresetId,
  });

  // Use PublishLongFormNowUseCase for immediate publishing
  const correlationId =
    extractCorrelationId(request.headers) ?? getCorrelationId();
  const publishUseCase = new PublishLongFormNowUseCase();
  await publishUseCase.execute({
    postId,
    userId,
    signedEvent: signedEventJson,
    relays: sanitizedRelays,
    correlationId,
  });

  // Stay on current page and show modal there (for edit, redirect to posted page)
  return redirect(`/dashboard/published?published=${postId}&tab=longform`);
}

/**
 * Handle sched??e longform action
 */
async function handleScheduleLongform(
  postId: string,
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null,
  effectiveHashtags: string,
  showHashTagsinPosts: boolean,
  sessionPubkey: string
): Promise<Response> {
  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);
  const signedEvent = formData.get("signedEvent");
  const nostrEvent = formData.get("nostrEvent");

  // Get queueTypeId if queueType is provided and not "unassigned"
  let queueTypeId = null;
  if (queueType && queueType !== "unassigned") {
    const queueTypeRecord = await getQueueTypeByNameForUser(userId, queueType);
    queueTypeId = queueTypeRecord?.id ?? null;
  }

  if (!title.trim()) {
    return json({ error: ERROR_TITLE_REQUIRED }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return json({ error: ERROR_CONTENT_REQUIRED }, { status: 400 });
  }

  if (!summary?.trim()) {
    return json(
      { error: "Summary is required for publishing" },
      { status: 400 }
    );
  }

  if (!image?.trim()) {
    return json(
      { error: "Cover image is required for publishing" },
      { status: 400 }
    );
  }

  if (!signedEvent || !nostrEvent) {
    return json(
      { error: "Missing Nostr event data for publishing" },
      { status: 400 }
    );
  }

  const markdownContent = editorContent.trim();
  const sanitizedContent = sanitizeMarkdown(markdownContent);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  // Add hashtags to content if user has enabled it
  const contentWithHashtags = showHashTagsinPosts
    ? `${sanitizedContent}\\n\\n${effectiveHashtags}`
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

  assertSignedEventMatchesSessionPubkey({
    sessionPubkey,
    eventPubkey: signedEventJson.pubkey,
    context: { feature: "longform_edit", action: "schedule", postId },
  });

  // Extract published_at from NOSTR event tags for scheduling
  let scheduledForTimestamp: number | undefined = undefined;

  const publishedAtTag = signedEventJson.tags.find(
    (tag: unknown) => Array.isArray(tag) && tag[0] === "published_at"
  );
  if (publishedAtTag?.[1]) {
    const timestamp = parseInt(publishedAtTag[1].toString(), 10);
    if (!isNaN(timestamp)) {
      scheduledForTimestamp = timestamp;
    }
  }

  // Update the post first
  // Note: Flag fields (isPublished) have been removed. State machine will handle state transition.
  await updateLongFormPost({
    id: postId,
    userId,
    title,
    summary: finalSummary,
    content: contentWithHashtags,
    image,
    tags,
    signedEvent: signedEventJson,
    nostrEvent: nostrEventJson,
    scheduledAtUtc: scheduledForTimestamp ?? null,
    queueTypeId,
    hashTagPresetId,
  });

  // Use ScheduleLongFormPostUseCase if we have a scheduled time
  if (scheduledForTimestamp) {
    const scheduleLongFormPostUseCase = new ScheduleLongFormPostUseCase();
    const { fromUnixTimestamp } = await import("~/lib/temporal");
    const scheduledAtUtcZoned = fromUnixTimestamp(scheduledForTimestamp, "UTC");
    const nominalScheduledForRaw = formData.get("nominalScheduledFor");
    const nominalScheduledFor =
      nominalScheduledForRaw != null &&
      String(nominalScheduledForRaw).trim() !== ""
        ? parseInt(String(nominalScheduledForRaw), 10)
        : undefined;
    const nominalScheduledAtUtcZoned =
      nominalScheduledFor != null && Number.isFinite(nominalScheduledFor)
        ? fromUnixTimestamp(nominalScheduledFor, "UTC")
        : undefined;
    await scheduleLongFormPostUseCase.execute({
      postId,
      userId,
      scheduledAtUtc: scheduledAtUtcZoned,
      signedEvent: signedEventJson,
      ...(nominalScheduledAtUtcZoned != null
        ? { nominalScheduledAtUtc: nominalScheduledAtUtcZoned }
        : {}),
    });
  }

  return redirect(`/dashboard/scheduled?scheduled=${postId}&tab=longform`);
}

/**
 * Main action handler for longform edit page
 */
export async function handleLongFormEditAction(
  userId: string,
  postId: string,
  request: Request
): Promise<Response> {
  const user = await getUserById(userId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  const { showHashTagsinPosts } = user;
  const sessionPubkey = user.npub;
  const sanitizedRelays = await resolveExecutionRelays(userId);

  const contentType = request.headers.get("Content-Type") ?? "";
  let formData: FormData;

  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = createMemoryUploadHandler();
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  // Check for upload-image and restore-version first (handled separately)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

  if (_action === "upload-image") {
    return handleImageUpload(userId, formData);
  }

  if (_action === "restore-version") {
    const versionId = formData.get("versionId");
    if (typeof versionId === "string" && versionId) {
      const { restoreLongformDraftVersion } =
        await import("~/features/posts/server/drafts");
      const restoredId = await restoreLongformDraftVersion(versionId, userId);
      if (restoredId) {
        return redirect(`/dashboard/drafts/longform/edit/${restoredId}`);
      }
    }
  }

  // Validate non-file fields with Zod
  const result = validateFormDataOrRespond(
    formData,
    newLongformPostActionSchema
  );
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;

  // Type narrowing for discriminated union
  if (validatedData._action === "upload-image") {
    // This shouldn't happen as we handle it above, but TypeScript needs it
    return handleImageUpload(userId, formData);
  }

  const queueType = validatedData.queueType || "unassigned";
  const useHashtagPresets = validatedData.useHashtagPresets ?? false;
  const hashTagPresetId: string | null = useHashtagPresets
    ? (validatedData.hashTagPresetId ?? null)
    : null;

  // Get effective hashtags
  const effectiveHashtags = await getEffectiveHashtagsForPost(
    userId,
    useHashtagPresets,
    hashTagPresetId,
    queueType
  );

  // Handle different actions
  if (_action === "save-draft") {
    return handleSaveDraft(
      postId,
      userId,
      formData,
      queueType,
      hashTagPresetId
    );
  }

  if (_action === "publish") {
    return handlePublish(
      postId,
      userId,
      formData,
      queueType,
      hashTagPresetId,
      effectiveHashtags,
      showHashTagsinPosts,
      sanitizedRelays,
      request,
      sessionPubkey
    );
  }

  if (_action === "schedule-longform") {
    return handleScheduleLongform(
      postId,
      userId,
      formData,
      queueType,
      hashTagPresetId,
      effectiveHashtags,
      showHashTagsinPosts,
      sessionPubkey
    );
  }

  return json({ success: false });
}
