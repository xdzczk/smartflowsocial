import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { useState, useEffect } from "react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { requireUserId } from "~/features/auth/session.server";
import { getSelectedQueueStyle } from "~/features/posts/queueColors";
import { signEventFn } from "~/lib/nostr";
import { useOptionalUser } from "~/lib/remix-utils";
import { getPostById, updatePost } from "~/models/post.server";
import {
  getUserById,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/models/user.server";

export async function loader({ request, params }) {
  const userId = await requireUserId(request);
  const postId = params.id;

  const [post, user, queueTypes, hashTagPresets] = await Promise.all([
    getPostById({ id: postId, userId }),
    getUserById(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
  ]);

  if (!post || !post.draft) {
    throw new Response("Draft not found", { status: 404 });
  }

  return json({
    post,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    hashTagPresets,
  });
}

export async function action({ request, params }) {
  const userId = await requireUserId(request);
  const postId = params.id;
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "update") {
    const content = formData.get("content");
    const caption = formData.get("caption");
    const queueType = formData.get("queueType");
    const useHashtagPresets = formData.get("useHashtagPresets") === "on";
    const hashTagPresetId = useHashtagPresets
      ? formData.get("hashTagPresetId") || null
      : null;

    await updatePost({
      id: postId,
      userId,
      data: {
        content,
        caption,
        queueType,
        hashTagPresetId,
      },
    });

    return redirect("/dashboard/drafts");
  }

  if (_action === "resume") {
    const content = formData.get("content");
    const caption = formData.get("caption");
    const queueType = formData.get("queueType");
    const scheduledFor = formData.get("scheduledFor");
    const signedEvent = formData.get("signedEvent");
    const nostrEvent = formData.get("nostrEvent");
    const useHashtagPresets = formData.get("useHashtagPresets") === "on";
    const hashTagPresetId = useHashtagPresets
      ? formData.get("hashTagPresetId") || null
      : null;

    // Ensure the post is signed before resuming
    if (!signedEvent || !nostrEvent) {
      return json(
        { error: "Post must be signed before resuming" },
        { status: 400 },
      );
    }

    await updatePost({
      id: postId,
      userId,
      data: {
        content,
        caption,
        queueType,
        scheduledFor,
        signedEvent: JSON.parse(signedEvent),
        nostrEvent: JSON.parse(nostrEvent),
        draft: false,
        isScheduled: true,
        isPosted: false,
        hashTagPresetId,
      },
    });

    return redirect("/dashboard/scheduled");
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function EditDraft() {
  const { post, user, queueTypes, hashTagPresets } = useLoaderData();
  const fetcher = useFetcher();
  const currentUser = useOptionalUser();
  const [content, setContent] = useState(post.content || "");
  const [caption] = useState(post.caption || "");
  const [selectedQueue, setSelectedQueue] = useState(
    post.queueType?.name || post.queueType || "unassigned",
  );
  const [scheduledFor, setScheduledFor] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [useHashtagPresets, setUseHashtagPresets] = useState(
    !!post.hashTagPresetId,
  );
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState(
    post.hashTagPresetId || null,
  );
  const [selectedHashtags, setSelectedHashtags] = useState("");

  const isSubmitting = fetcher.state !== "idle";

  const handleResumeClick = () => {
    if (!scheduledFor) {
      alert("Please set a schedule time first");
      return;
    }
    setShowResumeModal(true);
  };

  const calculateQueueScheduleTime = async (queueTypeName) => {
    if (queueTypeName === "unassigned") {
      setScheduledFor("");
      return;
    }

    try {
      const response = await fetch("/api/queue-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queueTypeName,
          userId: currentUser?.id,
        }),
      });

      if (response.ok) {
        const { scheduledTime } = await response.json();
        setScheduledFor(scheduledTime);
      }
    } catch (error) {
      console.error("Error calculating schedule time:", error);
    }
  };

  const handleSignAndResume = async () => {
    try {
      const userTimezone = currentUser?.timezone || "UTC";
      let scheduledTime;

      if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
        const utcDate = new Date(scheduledFor);
        const userDate = new Date(scheduledFor).toLocaleString("en-US", {
          timeZone: userTimezone,
        });
        const userOffset =
          (new Date(userDate) - new Date(scheduledFor)) / 60000;
        utcDate.setMinutes(utcDate.getMinutes() - userOffset);
        scheduledTime = utcDate.getTime();
      } else {
        const dateObj = new Date(scheduledFor + "Z");
        scheduledTime = dateObj.getTime();
      }

      const scheduledForUnix = Math.floor(scheduledTime / 1000);

      // Get effective hashtags - prioritize manual selection over queue defaults
      let effectiveHashtags = "";

      if (useHashtagPresets) {
        // Manual hashtag presets are enabled
        if (selectedHashtags) {
          // Use manually selected hashtag preset
          effectiveHashtags = selectedHashtags;
        }
        // If useHashtagPresets is true but no manual preset selected, use no hashtags
        // This ensures manual hashtag preset selection overrides queue defaults
      } else {
        // Manual hashtag presets are disabled, use queue type's default hashtags
        try {
          const response = await fetch("/api/effective-hashtags", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: currentUser?.id,
              queueTypeName: selectedQueue,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            effectiveHashtags = data.hashtags || "";
          } else {
            // Fallback to user's default hashtags
            const tags = user?.hashTags?.tags;
            effectiveHashtags = Array.isArray(tags)
              ? tags.join(" ")
              : tags || "";
          }
        } catch (error) {
          console.error("Error fetching effective hashtags:", error);
          // Fallback to user's default hashtags
          const tags = user?.hashTags?.tags;
          effectiveHashtags = Array.isArray(tags) ? tags.join(" ") : tags || "";
        }
      }

      const tagArray = effectiveHashtags
        .split(" ")
        .filter((tag) => tag.length > 0)
        .map((tag) => ["t", tag.replace("#", "")]);

      // Include image URLs in the content to sign (caption first, then image URLs)
      const imageUrls = getImageUrls(post.fileUrl);
      const imageUrlsText = imageUrls.length > 0 ? imageUrls.join(" ") : "";

      let baseContent = content || caption;
      if (imageUrlsText) {
        baseContent = baseContent
          ? `${baseContent} ${imageUrlsText}`
          : imageUrlsText;
      }

      const contentToSign = currentUser?.showHashTagsinPosts
        ? `${baseContent}\n${effectiveHashtags}`
        : baseContent;

      const { nostrEvent, signedEvent } = await signEventFn({
        content: contentToSign,
        created_at: scheduledForUnix,
        kind: 1,
        tags: tagArray,
      });

      const formData = new FormData();
      formData.append("_action", "resume");
      formData.append("content", content);
      formData.append("caption", caption || content);
      formData.append("queueType", selectedQueue);
      formData.append("scheduledFor", scheduledForUnix.toString());
      formData.append("signedEvent", JSON.stringify(signedEvent));
      formData.append("nostrEvent", JSON.stringify(nostrEvent));

      // Add hashtag preset data
      if (useHashtagPresets && selectedHashtagPresetId) {
        formData.append("hashTagPresetId", selectedHashtagPresetId);
        formData.append("useHashtagPresets", "on");
      }

      fetcher.submit(formData, { method: "post" });
      setShowResumeModal(false);
    } catch (error) {
      console.error("Error signing event:", error);
      alert("Error signing the post. Please try again.");
    }
  };

  const handleHashtagPresetSelect = (presetId, hashtags) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
  };

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      calculateQueueScheduleTime(selectedQueue);
    } else {
      setScheduledFor("");
    }
  }, [selectedQueue, currentUser?.id]);

  // Initialize hashtag preset data on component mount
  useEffect(() => {
    if (post.hashTagPresetId && hashTagPresets.length > 0) {
      const preset = hashTagPresets.find((p) => p.id === post.hashTagPresetId);
      if (preset) {
        setSelectedHashtags(preset.tags || "");
      }
    }
  }, [post.hashTagPresetId, hashTagPresets]);

  const getImageUrls = (fileUrl) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    // Handle case where fileUrl is an array of JSON strings
    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]);
      } catch (e) {
        console.error("Error parsing fileUrl:", e);
        return [];
      }
    }

    // Handle direct URLs
    return fileUrl;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Draft
        </h1>
        <Link
          to="/dashboard/drafts"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
        >
          ← Back to Drafts
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Preview</h2>

          {/* Images */}
          {post.fileUrl && post.fileUrl.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {getImageUrls(post.fileUrl).map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="h-32 w-full rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}

          {/* Post Type */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Post Type
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                {post.postType}
              </span>
            </div>
          </div>

          {/* Queue */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Current Queue
              </span>
              {(() => {
                const currentQueueType = queueTypes.find((qt) => {
                  const queueName = typeof qt === "string" ? qt : qt.name;
                  return queueName === selectedQueue;
                });
                const queueColor =
                  typeof currentQueueType === "object"
                    ? currentQueueType.color
                    : null;

                if (queueColor) {
                  return (
                    <div
                      className="inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm"
                      style={{
                        backgroundColor: `${queueColor}20`,
                        color: queueColor,
                        borderColor: queueColor,
                      }}
                    >
                      {selectedQueue}
                    </div>
                  );
                } else {
                  return (
                    <div
                      className={`inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 ${getSelectedQueueStyle(selectedQueue, true).replace("hover:scale-105", "")} shadow-sm`}
                    >
                      {selectedQueue}
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Edit Content</h2>

          <fetcher.Form method="post" className="space-y-6">
            {/* Content/Caption */}
            <div>
              <Label htmlFor="content">
                {post.postType === "TEXT" ? "Content" : "Caption"}
              </Label>
              <Textarea
                id="content"
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  post.postType === "TEXT"
                    ? "Write your post content..."
                    : "Add a caption..."
                }
                rows={6}
                disabled={isSubmitting}
              />
              <input type="hidden" name="caption" value={caption || content} />
            </div>

            {/* Queue Selection */}
            <div>
              <Label>Queue Type</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {queueTypes.map((queue) => {
                  const queueName =
                    typeof queue === "string" ? queue : queue.name;
                  const queueColor =
                    typeof queue === "object" ? queue.color : null;
                  const isSelected = selectedQueue === queueName;

                  if (queueColor) {
                    return (
                      <button
                        key={queueName}
                        type="button"
                        onClick={() => setSelectedQueue(queueName)}
                        disabled={isSubmitting}
                        className="rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          backgroundColor: isSelected
                            ? queueColor
                            : `${queueColor}20`,
                          color: isSelected ? "white" : queueColor,
                          borderColor: queueColor,
                        }}
                      >
                        {queueName}
                      </button>
                    );
                  } else {
                    return (
                      <button
                        key={queueName}
                        type="button"
                        onClick={() => setSelectedQueue(queueName)}
                        disabled={isSubmitting}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${getSelectedQueueStyle(queueName, isSelected)} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {queueName}
                      </button>
                    );
                  }
                })}
              </div>
              <input type="hidden" name="queueType" value={selectedQueue} />
            </div>

            {/* Hashtag Preset Toggle */}
            <HashtagPresetToggle
              presets={hashTagPresets}
              selectedPresetId={selectedHashtagPresetId}
              onSelect={handleHashtagPresetSelect}
              disabled={isSubmitting}
              useHashtagPresets={useHashtagPresets}
              onUseHashtagPresetsChange={setUseHashtagPresets}
              showQueuePreset={selectedQueue !== "unassigned"}
              queueType={queueTypes.find(
                (q) => (typeof q === "string" ? q : q.name) === selectedQueue,
              )}
            />

            {/* Hidden inputs for hashtag preset data */}
            {useHashtagPresets && selectedHashtagPresetId ? (
              <input
                type="hidden"
                name="hashTagPresetId"
                value={selectedHashtagPresetId}
              />
            ) : null}
            {useHashtagPresets ? (
              <input type="hidden" name="useHashtagPresets" value="on" />
            ) : null}

            {/* Schedule Time (for resume action) */}
            <div>
              <Label htmlFor="scheduledFor">Schedule For (Resume)</Label>
              <input
                type="datetime-local"
                id="scheduledFor"
                name="scheduledFor"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Set a schedule time to resume this draft as a scheduled post
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                name="_action"
                value="update"
                variant="outline"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>

              {scheduledFor ? (
                <Button
                  type="button"
                  onClick={handleResumeClick}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Resume & Schedule
                </Button>
              ) : null}
            </div>
          </fetcher.Form>

          {/* Draft Info */}
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Draft Status
                </h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <p>
                    This post is saved as a draft and is not signed. It cannot
                    be published until you resume it and provide a schedule
                    time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resume Confirmation Modal */}
      {showResumeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Resume Draft</h2>
              <button
                onClick={() => setShowResumeModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Signing Required
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                      <p>
                        This draft needs to be signed before it can be
                        scheduled. The signing process will create a
                        cryptographic signature required for posting.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p>
                  <strong>Queue:</strong> {selectedQueue}
                </p>
                <p>
                  <strong>Scheduled for:</strong>{" "}
                  {new Date(scheduledFor).toLocaleString()}
                </p>
                <p>
                  <strong>Content:</strong>{" "}
                  {(content || caption)?.substring(0, 100)}...
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowResumeModal(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignAndResume}
                  disabled={isSubmitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Signing & Scheduling..." : "Sign & Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
