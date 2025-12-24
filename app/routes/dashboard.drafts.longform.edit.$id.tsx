import {
  json,
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useNavigation,
  useActionData,
} from "@remix-run/react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireUserId } from "~/features/auth/session.server";
import LongFormPost from "~/features/posts/components/LongFormPost";
import LongFormPreviewModal from "~/features/posts/components/LongFormPreviewModal";
import {
  createLongFormEvent,
  generateArticleIdentifier,
  convertEditorJSToMarkdown,
} from "~/features/posts/longform.server";
import {
  createUploadHandler,
  uploadBufferToS3,
} from "~/features/upload/s3.server";
import {
  sanitizeMarkdown,
  generateSummary,
} from "~/lib/markdown-sanitizer.server";
import { getAssets } from "~/models/asset.server";
import {
  getLongFormPost,
  updateLongFormPost,
} from "~/models/longformpost.server";
import {
  getUserHashTags,
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getEffectiveHashtags,
  getUserHashTagPresets,
  getHashTagPresetById,
  getQueueTypeByNameForUser,
} from "~/models/user.server";

export async function loader({ request, params }) {
  const userId = await requireUserId(request);
  const postId = params.id;

  if (!postId) {
    throw new Response("Post not found", { status: 404 });
  }

  const [
    post,
    tags,
    scheduleIntervals,
    queueTypes,
    user,
    assetsData,
    hashtagPresets,
  ] = await Promise.all([
    getLongFormPost({ id: postId, userId }),
    getUserHashTags(userId),
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserById(userId),
    getAssets({ userId, page: 1, limit: 100 }),
    getUserHashTagPresets(userId),
  ]);

  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  return json({
    post,
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    assets: assetsData.assets,
    userTimezone: user.timezone || "Etc/GMT",
    hashtagPresets,
  });
}

export async function action({ request, params }) {
  const userId = await requireUserId(request);
  const postId = params.id;

  if (!postId) {
    throw new Response("Post not found", { status: 404 });
  }

  const { userRelays, showHashTagsinPosts } = await getUserById(userId);
  const sanitizedRelays = userRelays.map((relay) => relay.trim());

  const contentType = request.headers.get("Content-Type") || "";
  let formData;

  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = composeUploadHandlers(
      createUploadHandler(userId),
      createMemoryUploadHandler(),
    );
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  const _action = formData.get("_action");
  const title = formData.get("title")?.toString() || "";
  const editorContent = formData.get("content")?.toString() || "";
  const image = formData.get("image")?.toString() || undefined;
  const customTags = formData.get("customTags")?.toString() || "";
  const tags =
    formData
      .get("tags")
      ?.toString()
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) || [];

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
    tags.length = 0;
    tags.push(...uniqueTags);
  }
  const summary = formData.get("summary")?.toString();
  const scheduledFor = formData.get("scheduledFor");
  const queueType = formData.get("queueType") || "unassigned";
  const useHashtagPresets = formData.get("useHashtagPresets") === "true";
  const hashTagPresetId = formData.get("hashTagPresetId")?.toString() || null;

  // Handle upload-image action first, before any validation
  if (_action === "upload-image") {
    const imageFile = formData.get("imageFile");

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
        // Process the file upload using shared S3 function
        const file = imageFile as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use the shared uploadBufferToS3 function
        const imageUrl = await uploadBufferToS3(buffer, userId, file.name);

        return json({ success: true, imageUrl });
      } catch (error) {
        console.error("S3 upload error:", error);
        return json({
          success: false,
          error: "Failed to upload image to storage.",
        });
      }
    }

    if (!imageFile) {
      return json({ success: false, error: "No image file provided." });
    } else {
      return json({
        success: false,
        error: "Image upload failed. Please try again.",
      });
    }
  }

  // Get effective hashtags - prioritize manual selection over queue defaults
  let effectiveHashtags = "";

  if (useHashtagPresets) {
    // Manual hashtag presets are enabled
    if (hashTagPresetId) {
      // Use manually selected hashtag preset
      const selectedPreset = await getHashTagPresetById(userId, hashTagPresetId);
      effectiveHashtags = selectedPreset?.tags || "";
    }
    // If useHashtagPresets is true but no manual preset selected, use no hashtags
    // This ensures manual hashtag preset selection overrides queue defaults
  } else {
    // Manual hashtag presets are disabled, use queue type's default hashtag preset
    effectiveHashtags = await getEffectiveHashtags(userId, queueType);
  }

  // Get queueTypeId if queueType is provided and not "unassigned"
  let queueTypeId = null;
  if (queueType && queueType !== "unassigned") {
    const queueTypeRecord = await getQueueTypeByNameForUser(userId, queueType);
    queueTypeId = queueTypeRecord?.id || null;
  }

  try {
    if (!title.trim()) {
      return json({ error: "Title is required" }, { status: 400 });
    }

    if (!editorContent.trim()) {
      return json({ error: "Content is required" }, { status: 400 });
    }

    let markdownContent;
    try {
      const editorData = JSON.parse(editorContent);
      markdownContent = convertEditorJSToMarkdown(editorData);
    } catch {
      markdownContent = editorContent;
    }

    const sanitizedContent = sanitizeMarkdown(markdownContent);
    const finalSummary = summary || generateSummary(sanitizedContent);

    // Add hashtags to content if user has enabled it
    const contentWithHashtags = showHashTagsinPosts
      ? `${sanitizedContent}\\n\\n${effectiveHashtags}`
      : sanitizedContent;

    if (_action === "save-draft") {
      // For drafts, save as markdown content so it's consistent across all states
      await updateLongFormPost({
        id: postId,
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

    if (_action === "publish" || _action === "schedule-longform") {
      // Additional validation for publishing/scheduling
      if (!summary || !summary.trim()) {
        return json(
          { error: "Summary is required for publishing" },
          { status: 400 },
        );
      }

      if (!image || !image.trim()) {
        return json(
          { error: "Cover image is required for publishing" },
          { status: 400 },
        );
      }

      const signedEvent = formData.get("signedEvent");
      const nostrEvent = formData.get("nostrEvent");

      if (!signedEvent || !nostrEvent) {
        return json(
          { error: "Missing Nostr event data for publishing" },
          { status: 400 },
        );
      }

      const signedEventJson = JSON.parse(signedEvent.toString());
      const nostrEventJson = JSON.parse(nostrEvent.toString());

      if (_action === "publish") {
        await updateLongFormPost({
          id: postId,
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

        const response = await fetch(process.env.NOSTR_PUBLISHER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relays: sanitizedRelays,
            event: signedEventJson,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to publish to nostr: ${response.statusText}`);
        }

        return redirect("/dashboard/posted?tab=longform");
      } else if (_action === "schedule-longform") {
        // Extract published_at from NOSTR event tags for scheduling
        let scheduledForTimestamp: string | null = null;

        if (signedEventJson?.tags) {
          const publishedAtTag = signedEventJson.tags.find(
            (tag) => Array.isArray(tag) && tag[0] === "published_at",
          );
          if (publishedAtTag && publishedAtTag[1]) {
            scheduledForTimestamp = publishedAtTag[1].toString();
          }
        }

        await updateLongFormPost({
          id: postId,
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
    }

    return json({ success: false });
  } catch (error) {
    // Use centralized error handling
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function EditLongFormPost() {
  const {
    post,
    userId,
    tags: userTags,
    scheduleIntervals,
    queueTypes,
    assets,
    userTimezone,
    hashtagPresets,
  } = useLoaderData();
  const navigation = useNavigation();
  const actionData = useActionData();

  const [displayedHashtags, setDisplayedHashtags] = useState(userTags || "");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState({
    title: "",
    summary: "",
    content: "",
    image: "",
  });

  // Hashtag preset state
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState("");
  const [selectedHashtags, setSelectedHashtags] = useState("");

  const isSubmitting = navigation.state === "submitting";

  // Hashtag preset handlers
  const handleHashtagPresetToggle = (enabled) => {
    setUseHashtagPresets(enabled);
    if (!enabled) {
      // If disabled, clear manual selection and revert to queue/user default
      setSelectedHashtagPresetId("");
      setSelectedHashtags("");
      // Note: displayedHashtags will be updated by queue type change logic
    } else if (selectedHashtags) {
      // If enabled and we have selected hashtags, show them
      setDisplayedHashtags(selectedHashtags);
    }
  };

  const handleHashtagPresetChange = (presetId) => {
    setSelectedHashtagPresetId(presetId);
    const preset = hashtagPresets.find((p) => p.id === presetId);
    const tags = preset?.tags || "";
    setSelectedHashtags(tags);
    if (useHashtagPresets) {
      setDisplayedHashtags(tags);
    }
  };

  // Function to update displayed hashtags when queue type changes
  const updateDisplayedHashtags = async (queueTypeName) => {
    // Don't update if using manual hashtag presets
    if (useHashtagPresets) {
      return;
    }

    if (queueTypeName === "unassigned") {
      setDisplayedHashtags(userTags || "");
      return;
    }

    try {
      const response = await fetch("/api/effective-hashtags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeName: queueTypeName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDisplayedHashtags(data.hashtags || userTags || "");
      } else {
        setDisplayedHashtags(userTags || "");
      }
    } catch (error) {
      console.error("Error fetching effective hashtags:", error);
      setDisplayedHashtags(userTags || "");
    }
  };

  const handlePreview = (data) => {
    setPreviewData(data);
    setShowPreviewModal(true);
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Edit Long-form Post
      </h1>

      <Badge variant="secondary" className="mb-6">
        <svg
          className="hi-solid hi-hashtag mr-1 inline-block size-4 opacity-75"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z"
            clipRule="evenodd"
          />
        </svg>
        {displayedHashtags}
      </Badge>

      {actionData?.error && !actionData?.success ? (
        <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
          {actionData.error}
        </div>
      ) : null}

      <Form method="post" encType="multipart/form-data">
        <LongFormPost
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={userTags}
          assets={assets}
          onQueueTypeChange={updateDisplayedHashtags}
          onPreview={handlePreview}
          initialData={post}
          isEditing={true}
          hashTagPresets={hashtagPresets}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onUseHashtagPresetsChange={handleHashtagPresetToggle}
          onHashtagPresetChange={handleHashtagPresetChange}
        />
      </Form>

      {/* Preview Modal */}
      <LongFormPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={previewData.title}
        summary={previewData.summary}
        content={previewData.content}
        image={previewData.image}
        displayedHashtags={displayedHashtags}
      />
    </div>
  );
}
