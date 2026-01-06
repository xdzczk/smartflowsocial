import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { requireUserId } from "~/features/auth";
import { getQueueColor } from "~/features/posts/queueColors";
import {
  loadTemplateEditData,
  handleTemplateEditAction,
} from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";
import { formatDate, getImageUrls } from "~/lib/helpers";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const templateId = params["id"];

    if (!templateId) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Template ID is required");
    }

    return loadTemplateEditData(templateId, userId);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export const action = withCSRFProtection(
  async ({ request, params }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const templateId = params["id"];

      if (!templateId) {
        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Template ID is required");
      }

      const formData = await request.formData();
      return handleTemplateEditAction(formData, templateId, userId);
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

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function EditTemplate() {
  const data = useLoaderData<LoaderData>();
  const template =
    data &&
    typeof data === "object" &&
    "template" in data &&
    data.template &&
    typeof data.template === "object" &&
    !Array.isArray(data.template)
      ? data.template
      : null;

  // All hooks must be called before any early returns
  const updateNameFetcher = useFetcher<{ success?: boolean }>();
  const removePostFetcher = useFetcher();
  const deleteTemplateFetcher = useFetcher();
  const scheduleFetcher = useFetcher<{
    scheduleData?: Array<{
      caption: string;
      fileUrl: string[];
      queueType: string;
      scheduledFor: string;
    }>;
  }>();

  const templateNameValue =
    template && "name" in template && typeof template.name === "string"
      ? template.name
      : "";
  const [templateName, setTemplateName] = useState(templateNameValue);
  const [isEditingName, setIsEditingName] = useState(false);

  // Handle successful name update
  useEffect(() => {
    const fetcherData = updateNameFetcher.data;
    if (
      fetcherData &&
      typeof fetcherData === "object" &&
      !Array.isArray(fetcherData) &&
      "success" in fetcherData &&
      typeof fetcherData.success === "boolean" &&
      fetcherData.success
    ) {
      setIsEditingName(false);
    }
  }, [updateNameFetcher.data]);

  // Handle schedule data response
  useEffect(() => {
    const fetcherData = scheduleFetcher.data;
    if (
      fetcherData &&
      typeof fetcherData === "object" &&
      !Array.isArray(fetcherData) &&
      "scheduleData" in fetcherData &&
      Array.isArray(fetcherData.scheduleData)
    ) {
      // Store schedule data in sessionStorage
      sessionStorage.setItem(
        "repostData",
        JSON.stringify(fetcherData.scheduleData)
      );
      // Navigate to bulk posts page
      window.location.href = "/dashboard/bulkposts?mode=repost";
    }
  }, [scheduleFetcher.data]);

  if (!template) {
    return <div>Template not found</div>;
  }

  const handleUpdateName = () => {
    if (!templateName.trim()) return;

    const formData = new FormData();
    formData.append("_action", "updateName");
    formData.append("name", templateName.trim());

    updateNameFetcher.submit(formData, { method: "post" });
  };

  const handleRemovePost = (postId: string) => {
    const formData = new FormData();
    formData.append("_action", "removePost");
    formData.append("postId", postId);

    removePostFetcher.submit(formData, { method: "post" });
  };

  const handleDeleteTemplate = () => {
    if (
      !confirm(
        "Are you sure you want to delete this template? This action cannot be undone."
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("_action", "deleteTemplate");

    deleteTemplateFetcher.submit(formData, { method: "post" });
  };

  const handleScheduleTemplate = () => {
    const formData = new FormData();
    formData.append("_action", "schedule");

    scheduleFetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/templates"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Templates
          </Link>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScheduleTemplate}
            disabled={
              scheduleFetcher.state !== "idle" ||
              !Array.isArray(template.posts) ||
              template.posts.length === 0
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {scheduleFetcher.state !== "idle" ? "Loading..." : "Schedule Posts"}
          </button>
          <button
            onClick={handleDeleteTemplate}
            disabled={deleteTemplateFetcher.state !== "idle"}
            className="rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {deleteTemplateFetcher.state !== "idle"
              ? "Deleting..."
              : "Delete Template"}
          </button>
        </div>
      </div>

      {/* Header and description below back button */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xl font-bold dark:border-gray-600 dark:bg-gray-700"
              />
              <button
                onClick={handleUpdateName}
                disabled={
                  updateNameFetcher.state !== "idle" || !templateName.trim()
                }
                className="rounded-lg bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:bg-green-300"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setTemplateName(templateNameValue);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{templateNameValue}</h1>
              <button
                onClick={() => setIsEditingName(true)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {Array.isArray(template.posts) ? template.posts.length : 0} post
          {Array.isArray(template.posts) && template.posts.length !== 1
            ? "s"
            : ""}{" "}
          • Created{" "}
          {template && "createdAt" in template && template.createdAt
            ? formatDate(template.createdAt as string | Date)
            : "Unknown"}
        </p>
      </div>

      {!Array.isArray(template.posts) || template.posts.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No posts in this template
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This template is empty. You can delete it or go back to add posts.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.isArray(template.posts)
            ? template.posts
                .map((post: unknown) => {
                  if (!post || typeof post !== "object" || !("id" in post)) {
                    return null;
                  }
                  const postId =
                    typeof post.id === "string"
                      ? post.id
                      : String(post.id ?? "");
                  const postFileUrl = "fileUrl" in post ? post.fileUrl : null;
                  const postCaption =
                    "caption" in post && typeof post.caption === "string"
                      ? post.caption
                      : "";
                  const postQueueType =
                    "queueType" in post &&
                    post.queueType &&
                    typeof post.queueType === "object" &&
                    !Array.isArray(post.queueType)
                      ? post.queueType
                      : null;
                  const postPostedAt =
                    "postedAt" in post ? post.postedAt : null;
                  const postSignedEvent =
                    "signedEvent" in post &&
                    post.signedEvent &&
                    typeof post.signedEvent === "object" &&
                    !Array.isArray(post.signedEvent)
                      ? post.signedEvent
                      : null;
                  const signedEventId =
                    postSignedEvent &&
                    "id" in postSignedEvent &&
                    typeof postSignedEvent.id === "string"
                      ? postSignedEvent.id
                      : "";
                  const queueTypeName =
                    postQueueType &&
                    "name" in postQueueType &&
                    typeof postQueueType.name === "string"
                      ? postQueueType.name
                      : "unassigned";
                  const queueTypeColor =
                    postQueueType &&
                    "color" in postQueueType &&
                    (typeof postQueueType.color === "string" ||
                      postQueueType.color === null)
                      ? postQueueType.color
                      : null;

                  const hasFileUrl =
                    postFileUrl &&
                    (Array.isArray(postFileUrl)
                      ? postFileUrl.length > 0
                      : typeof postFileUrl === "string" &&
                        postFileUrl.length > 0);
                  const fileUrlArray = Array.isArray(postFileUrl)
                    ? postFileUrl
                    : typeof postFileUrl === "string"
                      ? [postFileUrl]
                      : [];
                  const firstImageUrl =
                    fileUrlArray.length > 0
                      ? getImageUrls(fileUrlArray)[0]
                      : "";

                  return (
                    <div
                      key={postId}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="mb-3">
                        {hasFileUrl && firstImageUrl ? (
                          <img
                            src={firstImageUrl}
                            alt="Post preview"
                            className="h-48 w-full rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-48 w-full items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            TEXT POST
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <p className="line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
                          {postCaption}
                        </p>
                      </div>

                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {postQueueType ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${(() => {
                                const colors = getQueueColor(
                                  queueTypeName,
                                  queueTypeColor
                                );
                                return colors
                                  ? `${colors.bg} ${colors.text}`
                                  : "";
                              })()}`}
                            >
                              {queueTypeName}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Posted{" "}
                          {postPostedAt
                            ? formatDate(postPostedAt as string | Date)
                            : "Not posted yet"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <Link
                          to={`https://primal.net/e/${signedEventId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Original
                        </Link>
                        <button
                          onClick={() => handleRemovePost(postId)}
                          disabled={removePostFetcher.state !== "idle"}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          {removePostFetcher.state !== "idle"
                            ? "..."
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  );
                })
                .filter((item): item is JSX.Element => item !== null)
            : null}
        </div>
      )}
    </div>
  );
}
