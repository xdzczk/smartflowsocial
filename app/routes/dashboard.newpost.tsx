import {
  json,
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireUserId } from "~/features/auth/session.server";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import MediaPost from "~/features/posts/components/MediaPost";
import NewPostImagesConfirmation from "~/features/posts/components/NewPostImagesConfirmation";
import TextPost from "~/features/posts/components/TextPost";
import { createUploadHandler } from "~/features/upload/s3.server";
import { getAssets } from "~/models/asset.server";
import { createPost } from "~/models/post.server";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getHashTagPresetById,
} from "~/models/user.server";

export async function loader({ request }) {
  const userId = await requireUserId(request);
  // Require that the user has any subscription before accessing dashboard child routes
  await requireAnySubscription(userId);
  const scheduleIntervals = await getScheduleInterval(userId);
  const queueTypes = await getQueueTypes(userId);
  const hashTagPresets = await getUserHashTagPresets(userId);
  const assetsData = await getAssets({ userId, page: 1, limit: 50 });
  return json({
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    assets: assetsData.assets,
  });
}

export async function action({ request }) {
  const userId = await requireUserId(request);

  const { userRelays, showHashTagsinPosts } = await getUserById(userId);

  const sanitizedRelays = userRelays.map((relay) => relay.trim());

  // Check content type before parsing
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

  const caption = formData.get("caption");
  const scheduledFor = formData.get("scheduledFor");
  const queueType = formData.get("queueType") || "unassigned";
  const queueTypeId = formData.get("queueTypeId") || null; // Get queueTypeId from form
  const isRecyclable = formData.get("isRecyclable") === "on";
  const useHashtagPresets = formData.get("useHashtagPresets") === "on";
  const manualHashTagPresetId = useHashtagPresets
    ? formData.get("hashTagPresetId") || null
    : null;


  // Get hashtag preset tags - either manual selection or queue default
  let hashTagPresetTags = "";
  let hashTagPresetId = null;

  if (useHashtagPresets && manualHashTagPresetId) {
    // Use manually selected hashtag preset
    const preset = await getHashTagPresetById(userId, manualHashTagPresetId);
    hashTagPresetTags = preset?.tags || "";
    hashTagPresetId = manualHashTagPresetId;
  } else if (!useHashtagPresets && queueType !== "unassigned") {
    // Use queue type's default hashtag preset
    const queueTypes = await getQueueTypes(userId);

    let selectedQueueType;
    if (queueTypeId) {
      // Prefer lookup by ID if available
      selectedQueueType = queueTypes.find((qt) => qt.id === queueTypeId);
    } else {
      // Fallback to name-based lookup for backward compatibility
      selectedQueueType = queueTypes.find((qt) => qt.name === queueType);
    }

    if (selectedQueueType && selectedQueueType.hashTagPreset) {
      hashTagPresetTags = selectedQueueType.hashTagPreset.tags || "";
      hashTagPresetId = selectedQueueType.hashTagPreset.id;
    }
  }

  if (_action === "draft-text") {
    try {
      const content = formData.get("content");

      const post = await createPost({
        userId,
        content:
          showHashTagsinPosts && hashTagPresetTags
            ? `${content}\n${hashTagPresetTags}`
            : content,
        caption:
          showHashTagsinPosts && hashTagPresetTags
            ? `${content}\n${hashTagPresetTags}`
            : content,
        fileUrl: [],
        isScheduled: false,
        isPosted: false,
        postType: "TEXT",
        tags: [],
        queueType,
        queueTypeId,
        draft: true,
        isRecyclable,
        hashTagPresetId,
      });

      return redirect("/dashboard/drafts");
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }

  if (_action === "post-text" || _action === "schedule-text") {
    try {
      const content = formData.get("content");

      const signedEvent = formData.get("signedEvent");
      const nostrEvent = formData.get("nostrEvent");
      const signedEventJson = JSON.parse(signedEvent);

      if (_action === "post-text") {
        // For immediate posts, use current GMT time

        const post = await createPost({
          userId,
          content:
            showHashTagsinPosts && hashTagPresetTags
              ? `${content}\n${hashTagPresetTags}`
              : content,
          caption:
            showHashTagsinPosts && hashTagPresetTags
              ? `${content}\n${hashTagPresetTags}`
              : content,
          postedAt: new Date(),
          scheduledFor: signedEventJson.created_at,
          isScheduled: _action === "schedule-text",
          isPosted: _action === "post-text",
          signedEvent: JSON.parse(signedEvent),
          nostrEvent: JSON.parse(nostrEvent),
          postType: "TEXT",
          tags: [],
          queueType,
          queueTypeId,
          isRecyclable,
          hashTagPresetId,
        });

        const response = await fetch(process.env.NOSTR_PUBLISHER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relays: sanitizedRelays,
            event: post.signedEvent,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to post to nostr publisher: ${response.statusText}`,
          );
        }

        return redirect("/dashboard/posted");
      } else if (_action === "schedule-text") {
        await createPost({
          userId,
          content:
            showHashTagsinPosts && hashTagPresetTags
              ? `${content}\n${hashTagPresetTags}`
              : content,
          caption:
            showHashTagsinPosts && hashTagPresetTags
              ? `${content}\n${hashTagPresetTags}`
              : content,
          scheduledFor: signedEventJson.created_at,
          isScheduled: true,
          isPosted: false,
          signedEvent: JSON.parse(signedEvent),
          nostrEvent: JSON.parse(nostrEvent),
          postType: "TEXT",
          tags: [],
          queueType,
          queueTypeId,
          isRecyclable,
          hashTagPresetId,
        });

        return redirect("/dashboard/scheduled");
      }
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }

  if (
    _action === "upload-images-preview" ||
    _action === "upload-media-preview"
  ) {
    const files = formData.getAll("files");

    // Validate files are not empty and are valid URLs
    const hasValidFiles = files.some((file) => {
      try {
        new URL(file); // Check if valid URL
        return true;
      } catch {
        return false;
      }
    });

    if (!hasValidFiles) {
      return json(
        { success: false, error: "Upload failed, please try again" },
        { status: 400 },
      );
    }

    const fileUrls = files.map((fileUrl) => ({
      fileUrl,
      scheduledFor,
      caption,
      queueType,
    }));

    return json({ success: true, fileUrls });
  }

  if (_action === "post-images" || _action === "post-media") {
    const signedEvent = JSON.parse(formData.get("signedEvent"));
    const nostrEvent = JSON.parse(formData.get("nostrEvent"));
    const fileUrl = formData.get("fileUrl");
    const caption = formData.get("caption");

    // Infer media type from URL extension
    let isVideo = false;
    try {
      const urls = JSON.parse(fileUrl);
      if (urls && urls.length > 0) {
        const firstUrl = urls[0];
        const lower = firstUrl.toLowerCase();
        isVideo = [
          ".mp4",
          ".webm",
          ".ogg",
          ".mov",
          ".avi",
          ".mkv",
          ".m4v",
        ].some((ext) => lower.includes(ext));
      }
    } catch (e) {
      // If parsing fails, try direct string
      const lower = (fileUrl || "").toString().toLowerCase();
      isVideo = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v"].some(
        (ext) => lower.includes(ext),
      );
    }

    const post = await createPost({
      userId,
      content:
        showHashTagsinPosts && hashTagPresetTags
          ? `${caption}\n${hashTagPresetTags}`
          : caption,
      caption:
        showHashTagsinPosts && hashTagPresetTags
          ? `${caption}\n${hashTagPresetTags}`
          : caption,
      postedAt: new Date(),
      isScheduled: false,
      isPosted: true,
      fileUrl: JSON.parse(fileUrl),
      scheduledFor: signedEvent.created_at,
      nostrEventId: signedEvent.id,
      nostrEvent,
      signedEvent,
      postType: isVideo ? "VIDEO" : "IMAGE",
      tags: [],
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
    });

    const response = await fetch(process.env.NOSTR_PUBLISHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relays: sanitizedRelays,
        event: post.signedEvent,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to post to nostr publisher: ${response.statusText}`,
      );
    }

    return redirect("/dashboard/posted");
  } else if (_action === "schedule-images" || _action === "schedule-media") {
    const signedEvent = JSON.parse(formData.get("signedEvent"));
    const nostrEvent = JSON.parse(formData.get("nostrEvent"));
    const fileUrl = formData.get("fileUrl");
    const caption = formData.get("caption");

    // Infer media type from URL extension
    let isVideo = false;
    try {
      const urls = JSON.parse(fileUrl);
      if (urls && urls.length > 0) {
        const firstUrl = urls[0];
        const lower = firstUrl.toLowerCase();
        isVideo = [
          ".mp4",
          ".webm",
          ".ogg",
          ".mov",
          ".avi",
          ".mkv",
          ".m4v",
        ].some((ext) => lower.includes(ext));
      }
    } catch (e) {
      // If parsing fails, try direct string
      const lower = (fileUrl || "").toString().toLowerCase();
      isVideo = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v"].some(
        (ext) => lower.includes(ext),
      );
    }

    const post = await createPost({
      userId,
      content:
        showHashTagsinPosts && hashTagPresetTags
          ? `${caption}\n${hashTagPresetTags}`
          : caption,
      caption:
        showHashTagsinPosts && hashTagPresetTags
          ? `${caption}\n${hashTagPresetTags}`
          : caption,
      fileUrl: JSON.parse(fileUrl),
      scheduledFor: signedEvent.created_at,
      isScheduled: true,
      isPosted: false,
      signedEvent: signedEvent,
      nostrEvent: nostrEvent,
      postType: isVideo ? "VIDEO" : "IMAGE",
      tags: [],
      queueType,
      queueTypeId,
      isRecyclable,
      hashTagPresetId,
    });

    return redirect("/dashboard/scheduled");
  }

  if (_action === "draft-images" || _action === "draft-media") {
    const fileUrl = formData.get("fileUrl");
    const caption = formData.get("caption");

    // Infer media type from URL extension for drafts
    let postType = "IMAGE"; // default
    if (fileUrl) {
      try {
        const urls = JSON.parse(fileUrl);
        if (urls && urls.length > 0) {
          const firstUrl = urls[0];
          const lower = firstUrl.toLowerCase();
          const isVideo = [
            ".mp4",
            ".webm",
            ".ogg",
            ".mov",
            ".avi",
            ".mkv",
            ".m4v",
          ].some((ext) => lower.includes(ext));
          postType = isVideo ? "VIDEO" : "IMAGE";
        }
      } catch (e) {
        // If parsing fails, keep default IMAGE postType
        console.warn("Failed to parse fileUrl for draft:", e);
      }
    }

    const post = await createPost({
      userId,
      content:
        showHashTagsinPosts && hashTagPresetTags
          ? `${caption}\n${hashTagPresetTags}`
          : caption,
      caption:
        showHashTagsinPosts && hashTagPresetTags
          ? `${caption}\n${hashTagPresetTags}`
          : caption,
      fileUrl: JSON.parse(fileUrl),
      isScheduled: false,
      isPosted: false,
      postType,
      tags: [],
      queueType,
      queueTypeId,
      draft: true,
      isRecyclable,
      hashTagPresetId,
    });

    return redirect("/dashboard/drafts");
  }

  return json({ success: false });
}
export default function NewPost() {
  const { queueTypes, hashTagPresets, assets } = useLoaderData<typeof loader>();

  const [files, setFiles] = useState([]);
  const [selectedQueueType, setSelectedQueueType] = useState("unassigned");
  const [selectedHashTagPresetId, setSelectedHashTagPresetId] = useState(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [preparedImageEvent, setPreparedImageEvent] = useState(null);

  const handleQueueTypeChange = (queueTypeName) => {
    setSelectedQueueType(queueTypeName);
  };

  const handleHashtagPresetSelect = (presetId, hashtags) => {
    setSelectedHashTagPresetId(presetId);
    setSelectedHashtags(hashtags);
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Create a post
      </h1>

      {selectedHashtags ? (
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
          {selectedHashtags}
        </Badge>
      ) : null}

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text">Text Post</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>
        <TabsContent value="text">
          <TextPost
            queueTypes={queueTypes}
            assets={assets}
            hashTagPresets={hashTagPresets}
            selectedQueueType={selectedQueueType}
            onQueueTypeChange={handleQueueTypeChange}
            selectedHashTagPresetId={selectedHashTagPresetId}
            onHashtagPresetChange={handleHashtagPresetSelect}
          />
        </TabsContent>
        <TabsContent value="media">
          {showImagePreview ? (
            <NewPostImagesConfirmation
              preparedEvents={[preparedImageEvent]}
              files={files}
              onCancel={() => setShowImagePreview(false)}
              postsCount={1}
              selectedHashTagPresetId={selectedHashTagPresetId}
            />
          ) : (
            <MediaPost
              files={files}
              setFiles={setFiles}
              setShowImagePreview={setShowImagePreview}
              setPreparedImageEvent={setPreparedImageEvent}
              queueTypes={queueTypes}
              hashTagPresets={hashTagPresets}
              selectedQueueType={selectedQueueType}
              onQueueTypeChange={handleQueueTypeChange}
              selectedHashTagPresetId={selectedHashTagPresetId}
              onHashtagPresetChange={handleHashtagPresetSelect}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
