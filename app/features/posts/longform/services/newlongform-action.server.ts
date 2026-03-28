/**
 * New longform action handlers
 * Centralized action processing for new longform post page
 */

import {
  json,
  redirect,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import {
  resolveQueueTypeId,
  createPostWithOutbox,
  getLongFormPost,
  updateLongFormPost,
} from "~/features/posts/server";
import {
  createLongformDraftVersion,
  LONGFORM_SNAPSHOT_SCHEMA_VERSION,
} from "~/features/posts/server/drafts";
import { PostStateMachine } from "~/features/posts/state-machine/post-state-machine.server";
import { resolveExecutionRelaysFromForm } from "~/features/relays/relay-resolution.server";
import { uploadBufferToS3 } from "~/features/upload/s3.server";
import { assertMediaUrlsReady } from "~/features/upload/services/media-readiness.server";
import {
  getUserById,
  getQueueTypes,
  getHashTagPresetById,
} from "~/features/user";
import { logWarning } from "~/lib/error-logger.server";
import {
  sanitizeMarkdown,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";
import {
  newLongformPostActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { CreateLongFormPostUseCase } from "../use-cases/create-longform-post.use-case.server";
import { PublishLongFormNowUseCase } from "../use-cases/publish-longform-now.use-case.server";

const ERROR_TITLE_REQUIRED = "Title is required";
const ERROR_CONTENT_REQUIRED = "Content is required";

interface QuoteScheduleItem {
  scheduledFor: number;
  signedEvent: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
    sig: string;
  };
  caption?: string;
}

function parseQuoteSchedulesFromForm(formData: FormData): QuoteScheduleItem[] {
  const quoteSchedulesStr = formData.get("quoteSchedules");
  const alsoScheduleQuote = formData.get("alsoScheduleQuote") === "on";
  const quoteScheduledForStr = formData.get("quoteScheduledFor");
  const quoteSignedEventStr = formData.get("quoteSignedEvent");
  const quoteCaption = formData.get("quoteCaption");
  let list: QuoteScheduleItem[] = [];
  if (quoteSchedulesStr && typeof quoteSchedulesStr === "string") {
    try {
      const parsed = JSON.parse(quoteSchedulesStr) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (p): p is QuoteScheduleItem =>
            typeof p === "object" &&
            p !== null &&
            "scheduledFor" in p &&
            "signedEvent" in p &&
            typeof (p as QuoteScheduleItem).scheduledFor === "number" &&
            typeof (p as QuoteScheduleItem).signedEvent === "object"
        );
      }
    } catch {
      list = [];
    }
  }
  if (
    list.length === 0 &&
    alsoScheduleQuote &&
    quoteScheduledForStr &&
    quoteSignedEventStr
  ) {
    const quoteScheduledFor = parseInt(String(quoteScheduledForStr), 10);
    if (!Number.isNaN(quoteScheduledFor)) {
      try {
        const quoteSignedEvent = JSON.parse(
          String(quoteSignedEventStr)
        ) as QuoteScheduleItem["signedEvent"];
        list = [
          {
            scheduledFor: quoteScheduledFor,
            signedEvent: quoteSignedEvent,
            caption: quoteCaption ? String(quoteCaption) : undefined,
          },
        ];
      } catch {
        // keep empty
      }
    }
  }
  return list;
}

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
    return allTags.filter(
      (tag, index) =>
        allTags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) ===
        index
    );
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
  queueType: string
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
          typeof preset === "object" &&
          "tags" in preset &&
          typeof preset.tags === "string"
        ) {
          hashTagPresetTags = preset.tags;
        }
        if (
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

  // If it's a File object, process it using S3 upload
  // (Blossom uploads are handled client-side)
  if (
    imageFile &&
    typeof imageFile === "object" &&
    imageFile.constructor.name === "File"
  ) {
    try {
      logWarning("Using temporary longform S3 cover-image fallback", {
        userId,
        action: "newlongform.upload-image",
        fileName: imageFile.name,
      });
      const file = imageFile;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
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
      const { ExternalServiceError } = await import("~/lib/errors");
      const { handleActionError } = await import("~/lib/error-handler.server");
      const uploadError = new ExternalServiceError(
        "Failed to upload image to storage",
        500,
        {
          service: "S3",
          fileName: imageFile.name,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
      return handleActionError(uploadError);
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
 * Persist draft for new longform page (save-draft action).
 * Returns error response or { longFormPostId } on success.
 */
async function persistDraft(
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null
): Promise<Response | { longFormPostId: string }> {
  const longFormPostIdRaw = formData.get("longFormPostId");
  const existingId =
    longFormPostIdRaw != null && String(longFormPostIdRaw).trim() !== ""
      ? String(longFormPostIdRaw).trim()
      : null;

  const title = formData.get("title")?.toString() ?? "";
  const editorContent = formData.get("content")?.toString() ?? "";
  const image = formData.get("image")?.toString() ?? undefined;
  const summary = formData.get("summary")?.toString();
  const tags = parseTags(formData);

  const queueTypeId = await resolveQueueTypeId(
    userId,
    null,
    queueType === "Unassigned" ? null : queueType
  );

  if (!title.trim()) {
    return json({ error: ERROR_TITLE_REQUIRED }, { status: 400 });
  }

  if (!editorContent.trim()) {
    return json({ error: ERROR_CONTENT_REQUIRED }, { status: 400 });
  }

  const markdownContent = editorContent.trim();
  const sanitizedContent = sanitizeMarkdown(markdownContent);
  const finalSummary = summary ?? generateSummary(sanitizedContent);

  if (existingId) {
    const existing = await getLongFormPost({ id: existingId, userId });
    if (!existing) {
      return json({ error: "Draft not found" }, { status: 404 });
    }
    if (existing.currentState !== "DRAFT") {
      return json(
        { error: "Only draft articles can be updated from compose" },
        { status: 400 }
      );
    }
    await updateLongFormPost({
      id: existingId,
      userId,
      title,
      summary: finalSummary,
      content: sanitizedContent,
      image,
      tags,
      queueTypeId,
      hashTagPresetId,
    });
    return { longFormPostId: existingId };
  }

  const createLongFormPostUseCase = new CreateLongFormPostUseCase();
  const result = await createLongFormPostUseCase.execute({
    userId,
    title,
    summary: finalSummary,
    content: sanitizedContent,
    image,
    tags,
    queueTypeId,
    queueType: queueType === "Unassigned" ? undefined : queueType,
    hashTagPresetId,
    isPublished: false,
  });

  return { longFormPostId: result.post.id };
}

/**
 * Handle save draft action: version snapshot + JSON (stay on compose).
 */
async function handleSaveDraft(
  userId: string,
  formData: FormData,
  queueType: string,
  hashTagPresetId: string | null,
  _correlationId?: string
): Promise<Response> {
  const persistResult = await persistDraft(
    userId,
    formData,
    queueType,
    hashTagPresetId
  );
  if (persistResult instanceof Response) return persistResult;
  const { longFormPostId } = persistResult;
  const queueTypeId = await resolveQueueTypeId(
    userId,
    null,
    queueType === "Unassigned" ? null : queueType
  );
  const title = formData.get("title")?.toString() ?? "";
  const content = formData.get("content")?.toString() ?? "";
  const summary = formData.get("summary")?.toString();
  const image = formData.get("image")?.toString() ?? undefined;
  const tags = parseTags(formData);
  await createLongformDraftVersion(
    longFormPostId,
    {
      schemaVersion: LONGFORM_SNAPSHOT_SCHEMA_VERSION,
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- form fields can be omitted */
      title: title ?? null,
      summary: summary ?? null,
      content: content ?? null,
      image: image ?? null,
      tags: tags ?? [],
      queueTypeId: queueTypeId ?? null,
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
    },
    userId
  );
  return json({
    ok: true,
    draftSaved: true,
    longFormPostId,
  });
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
  sessionPubkey: string
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
    queueType === "Unassigned" ? null : queueType
  );

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
  await assertMediaUrlsReady([image]);

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
  const contentWithHashtags =
    showHashTagsinPosts && hashTagPresetTags
      ? `${sanitizedContent}\n\n${hashTagPresetTags}`
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
    context: { feature: "newlongform", action: "publish" },
  });

  const quoteSchedules = parseQuoteSchedulesFromForm(formData);

  // Use CreateLongFormPostUseCase for post creation
  const createLongFormPostUseCase = new CreateLongFormPostUseCase();
  const result = await createLongFormPostUseCase.execute({
    userId,
    title,
    summary: finalSummary,
    content: contentWithHashtags,
    image,
    tags,
    queueTypeId,
    queueType: queueType === "Unassigned" ? undefined : queueType,
    hashTagPresetId,
    signedEvent: signedEventJson,
    nostrEvent: nostrEventJson,
    isPublished: true, // Publish immediately
  });

  // Create scheduled kind 1 quote posts if requested
  if (quoteSchedules.length > 0 && queueTypeId) {
    const stateMachine = new PostStateMachine();
    for (const item of quoteSchedules) {
      const quoteScheduledForDate = toPrismaDate(
        fromUnixTimestamp(item.scheduledFor, "UTC")
      );
      if (!quoteScheduledForDate) continue;
      const quotePost = await createPostWithOutbox(
        {
          userId,
          content: item.caption ?? "",
          caption: item.caption ?? "",
          fileUrl: [],
          postType: "TEXT",
          queueTypeId,
          hashTagPresetId,
          isRecyclable: false,
          signedEvent: item.signedEvent,
          nostrEvent: undefined,
          scheduledAtUtc: item.scheduledFor,
          tags: [],
          repost: false,
          isQuotedPost: true,
          quoteOfLongFormPostId: result.post.id,
          postKind: "QUOTE",
        },
        item.scheduledFor
      );
      await stateMachine.transition(
        quotePost.id,
        userId,
        "SCHEDULED",
        "Quote of article created with schedule"
      );
    }
  }

  // Use PublishLongFormNowUseCase for immediate publishing
  try {
    const publishUseCase = new PublishLongFormNowUseCase();
    await publishUseCase.execute({
      postId: result.post.id,
      userId,
      signedEvent: signedEventJson,
      relays: sanitizedRelays,
    });

    // Stay on current page and show modal there
    return redirect(
      `/dashboard/compose?type=article&published=${result.post.id}`
    );
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
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
  sessionPubkey: string,
  _correlationId?: string
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
    queueType === "Unassigned" ? null : queueType
  );

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
  await assertMediaUrlsReady([image]);

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
  const contentWithHashtags =
    showHashTagsinPosts && hashTagPresetTags
      ? `${sanitizedContent}\n\n${hashTagPresetTags}`
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
    context: { feature: "newlongform", action: "schedule" },
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

  const quoteSchedules = parseQuoteSchedulesFromForm(formData);

  // Use CreateLongFormPostUseCase for post creation with scheduling
  const createLongFormPostUseCase = new CreateLongFormPostUseCase();
  const result = await createLongFormPostUseCase.execute({
    userId,
    title,
    summary: finalSummary,
    content: contentWithHashtags,
    image,
    tags,
    queueTypeId,
    queueType: queueType === "Unassigned" ? undefined : queueType,
    hashTagPresetId,
    signedEvent: signedEventJson,
    nostrEvent: nostrEventJson,
    scheduledFor: scheduledForTimestamp,
    isPublished: false,
  });

  // Create scheduled kind 1 quote posts if requested
  if (quoteSchedules.length > 0 && queueTypeId) {
    const stateMachine = new PostStateMachine();
    for (const item of quoteSchedules) {
      const quoteScheduledForDate = toPrismaDate(
        fromUnixTimestamp(item.scheduledFor, "UTC")
      );
      if (!quoteScheduledForDate) continue;
      const quotePost = await createPostWithOutbox(
        {
          userId,
          content: item.caption ?? "",
          caption: item.caption ?? "",
          fileUrl: [],
          postType: "TEXT",
          queueTypeId,
          hashTagPresetId,
          isRecyclable: false,
          signedEvent: item.signedEvent,
          nostrEvent: undefined,
          scheduledAtUtc: item.scheduledFor,
          tags: [],
          repost: false,
          isQuotedPost: true,
          quoteOfLongFormPostId: result.post.id,
          postKind: "QUOTE",
        },
        item.scheduledFor
      );
      await stateMachine.transition(
        quotePost.id,
        userId,
        "SCHEDULED",
        "Quote of article created with schedule"
      );
    }
  }

  // Stay on current page and show modal there
  return redirect(
    `/dashboard/compose?type=article&scheduled=${result.post.id}`
  );
}

/**
 * Main action handler for new longform post page
 */
export async function handleNewLongFormAction(
  userId: string,
  request: Request
): Promise<Response> {
  const user = await getUserById(userId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  const { showHashTagsinPosts } = user;
  const sessionPubkey = user.npub;

  const contentType = request.headers.get("Content-Type") ?? "";
  let formData: FormData;

  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = createMemoryUploadHandler();
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  const sanitizedRelays = await resolveExecutionRelaysFromForm(
    userId,
    formData
  );

  // Check for upload-image action first (handled separately)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

  if (_action === "upload-image") {
    return handleImageUpload(userId, formData);
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
      queueType
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
      sessionPubkey
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
      sessionPubkey
    );
  }

  return json({ success: false });
}
