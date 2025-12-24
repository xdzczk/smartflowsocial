import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { requireUserId } from "~/features/auth/session.server";
import { getQueueColor } from "~/features/posts/queueColors";
import { formatDate, getImageUrls } from "~/lib/helpers";
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  removePostFromTemplate,
} from "~/models/template.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const templateId = params.id;

  if (!templateId) {
    throw new Response("Template ID is required", { status: 400 });
  }

  try {
    const template = await getTemplateById({ id: templateId, userId });

    if (!template) {
      throw new Response("Template not found", { status: 404 });
    }

    return json({ template });
  } catch (error) {
    console.error("Error loading template:", error);
    throw new Response("Error loading template", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const templateId = params.id;

  if (!templateId) {
    throw new Response("Template ID is required", { status: 400 });
  }
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "updateName") {
    const name = formData.get("name");
    if (!name || typeof name !== "string") {
      return json({ error: "Template name is required" }, { status: 400 });
    }

    await updateTemplate({
      id: templateId,
      userId,
      name,
    });

    return json({ success: true });
  }

  if (_action === "removePost") {
    const postId = formData.get("postId");
    if (!postId || typeof postId !== "string") {
      return json({ error: "Post ID is required" }, { status: 400 });
    }

    await removePostFromTemplate({
      templateId,
      postId,
      userId,
    });

    return json({ success: true });
  }

  if (_action === "deleteTemplate") {
    await deleteTemplate({ id: templateId, userId });
    return redirect("/dashboard/templates");
  }

  if (_action === "schedule") {
    const template = await getTemplateById({ id: templateId, userId });

    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }

    // Prepare template data for scheduling (similar to repost mode)
    const localDate = new Date();
    localDate.setHours(localDate.getHours() + 1);

    const templateData = template.posts.map((post, index) => {
      const scheduleDate = new Date(localDate);
      scheduleDate.setHours(scheduleDate.getHours() + index);

      return {
        caption: post.caption || "",
        fileUrl: post.fileUrl,
        queueType: post.queueType || "unassigned",
        scheduledFor: scheduleDate
          .toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
      };
    });

    return json({ scheduleData: templateData });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function EditTemplate() {
  const { template } = useLoaderData<typeof loader>();
  const updateNameFetcher = useFetcher<{ success?: boolean }>();
  const removePostFetcher = useFetcher();
  const deleteTemplateFetcher = useFetcher();
  const scheduleFetcher = useFetcher<{
    scheduleData?: {
      caption: string;
      fileUrl: string[];
      queueType: string;
      scheduledFor: string;
    }[];
  }>();

  const [templateName, setTemplateName] = useState(template.name || "");
  const [isEditingName, setIsEditingName] = useState(false);

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
        "Are you sure you want to delete this template? This action cannot be undone.",
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

  // Handle successful name update
  useEffect(() => {
    if (updateNameFetcher.data?.success) {
      setIsEditingName(false);
    }
  }, [updateNameFetcher.data]);

  // Handle schedule data response
  useEffect(() => {
    if (scheduleFetcher.data?.scheduleData) {
      // Store schedule data in sessionStorage
      sessionStorage.setItem(
        "repostData",
        JSON.stringify(scheduleFetcher.data.scheduleData),
      );
      // Navigate to bulk posts page
      window.location.href = "/dashboard/bulkposts?mode=repost";
    }
  }, [scheduleFetcher.data]);

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
              scheduleFetcher.state !== "idle" || template.posts.length === 0
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
                  setTemplateName(template.name || "");
                }}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{template.name}</h1>
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
          {template.posts.length} post
          {template.posts.length !== 1 ? "s" : ""} • Created{" "}
          {formatDate(template.createdAt)}
        </p>
      </div>

      {template.posts.length === 0 ? (
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
          {template.posts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-3">
                {post.fileUrl && post.fileUrl.length > 0 ? (
                  <img
                    src={getImageUrls(post.fileUrl)[0]}
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
                  {post.caption}
                </p>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {post.queueType ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${getQueueColor(post.queueType?.name || "unassigned", post.queueType?.color).bg} ${getQueueColor(post.queueType?.name || "unassigned", post.queueType?.color).text}`}
                    >
                      {post.queueType?.name || "unassigned"}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Posted{" "}
                  {post.postedAt ? formatDate(post.postedAt) : "Not posted yet"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  to={`https://primal.net/e/${typeof post.signedEvent === "object" && post.signedEvent?.id ? post.signedEvent.id : ""}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View Original
                </Link>
                <button
                  onClick={() => handleRemovePost(post.id)}
                  disabled={removePostFetcher.state !== "idle"}
                  className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {removePostFetcher.state !== "idle" ? "..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
