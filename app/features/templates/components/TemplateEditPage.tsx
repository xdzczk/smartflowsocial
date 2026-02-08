import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import React, { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { getQueueColor } from "~/features/posts/queue-colors";
import { getImageUrls } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

type LoaderData = unknown;
type Template = Record<string, unknown> & {
  name?: string;
  createdAt?: string | Date;
  posts?: unknown[];
};

export default function TemplateEditPage() {
  const { formatDate } = useFormattedDate();
  const data = useLoaderData<LoaderData>();
  const template =
    typeof data === "object" &&
    data !== null &&
    "template" in data &&
    typeof (data as { template?: unknown }).template === "object" &&
    !Array.isArray((data as { template?: unknown }).template)
      ? (data as { template: Template }).template
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

  const templateNameValue = template?.name ?? "";
  const [templateName, setTemplateName] = useState(templateNameValue);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      // Defer state update to avoid cascading renders
      setTimeout(() => {
        setIsEditingName(false);
      }, 0);
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
    const formData = new FormData();
    formData.append("_action", "deleteTemplate");

    deleteTemplateFetcher.submit(formData, { method: "post" });
    setShowDeleteConfirm(false);
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
            className="text-primary hover:text-primary/90 dark:text-muted-foreground dark:hover:text-foreground"
          >
            ← Back to Templates
          </Link>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScheduleTemplate}
            disabled={
              scheduleFetcher.state !== "idle" ||
              !Array.isArray((template as { posts?: unknown }).posts) ||
              ((template as { posts?: unknown }).posts as unknown[]).length ===
                0
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {scheduleFetcher.state !== "idle" ? "Loading..." : "Schedule Posts"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteTemplateFetcher.state !== "idle"}
            className="border-destructive text-destructive hover:bg-destructive/10 dark:border-destructive dark:text-destructive dark:hover:bg-destructive/10 rounded-lg border px-4 py-2 disabled:opacity-50"
          >
            {deleteTemplateFetcher.state !== "idle"
              ? "Deleting..."
              : "Delete Template"}
          </button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              disabled={deleteTemplateFetcher.state !== "idle"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header and description below back button */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="dark:border-border dark:bg-card border-border rounded-lg border px-3 py-1 text-xl font-bold"
              />
              <button
                onClick={handleUpdateName}
                disabled={
                  updateNameFetcher.state !== "idle" || !templateName.trim()
                }
                className="bg-success hover:bg-success/90 rounded-lg px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setTemplateName(templateNameValue);
                }}
                className="dark:border-border dark:hover:bg-muted border-border hover:bg-muted rounded-lg border px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{templateNameValue}</h1>
              <button
                onClick={() => setIsEditingName(true)}
                className="dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-muted-foreground"
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
        <p className="dark:text-muted-foreground text-muted-foreground text-sm">
          {Array.isArray((template as { posts?: unknown }).posts)
            ? ((template as { posts?: unknown }).posts as unknown[]).length
            : 0}{" "}
          post
          {Array.isArray((template as { posts?: unknown }).posts) &&
          ((template as { posts?: unknown }).posts as unknown[]).length !== 1
            ? "s"
            : ""}{" "}
          • Created{" "}
          {(template as { createdAt?: unknown }).createdAt
            ? formatDate((template as { createdAt: string | Date }).createdAt)
            : "Unknown"}
        </p>
      </div>

      {!Array.isArray((template as { posts?: unknown }).posts) ||
      ((template as { posts?: unknown }).posts as unknown[]).length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md">
            <svg
              className="text-foreground mx-auto h-12 w-12"
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
            <h3 className="dark:text-foreground text-foreground mt-4 text-lg font-medium">
              No posts in this template
            </h3>
            <p className="dark:text-muted-foreground text-muted-foreground mt-2 text-sm">
              This template is empty. You can delete it or go back to add posts.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.isArray((template as { posts?: unknown }).posts)
            ? ((template as { posts?: unknown }).posts as unknown[])
                .map((post: unknown) => {
                  if (!post || typeof post !== "object" || !("id" in post)) {
                    return null;
                  }
                  const postId =
                    typeof (post as { id?: unknown }).id === "string"
                      ? (post as { id: string }).id
                      : String((post as { id?: unknown }).id ?? "");
                  const postFileUrl =
                    "fileUrl" in (post as Record<string, unknown>)
                      ? (post as { fileUrl?: unknown }).fileUrl
                      : null;
                  const postCaption =
                    "caption" in (post as Record<string, unknown>) &&
                    typeof (post as { caption?: unknown }).caption === "string"
                      ? (post as unknown as { caption: string }).caption
                      : "";
                  const postQueueType =
                    "queueType" in (post as Record<string, unknown>) &&
                    (post as { queueType?: unknown }).queueType &&
                    typeof (post as { queueType?: unknown }).queueType ===
                      "object" &&
                    !Array.isArray((post as { queueType?: unknown }).queueType)
                      ? (
                          post as unknown as {
                            queueType: Record<string, unknown>;
                          }
                        ).queueType
                      : null;
                  const postPostedAt =
                    "publishedAt" in (post as Record<string, unknown>)
                      ? (post as { publishedAt?: unknown }).publishedAt
                      : null;
                  const postSignedEvent =
                    "signedEvent" in (post as Record<string, unknown>) &&
                    (post as { signedEvent?: unknown }).signedEvent &&
                    typeof (post as { signedEvent?: unknown }).signedEvent ===
                      "object" &&
                    !Array.isArray(
                      (post as { signedEvent?: unknown }).signedEvent
                    )
                      ? (
                          post as unknown as {
                            signedEvent: Record<string, unknown>;
                          }
                        ).signedEvent
                      : null;
                  const signedEventId =
                    postSignedEvent &&
                    "id" in postSignedEvent &&
                    typeof (postSignedEvent as { id?: unknown }).id === "string"
                      ? (postSignedEvent as { id: string }).id
                      : "";
                  const queueTypeName =
                    postQueueType &&
                    "name" in postQueueType &&
                    typeof (postQueueType as { name?: unknown }).name ===
                      "string"
                      ? (postQueueType as { name: string }).name
                      : "unassigned";
                  const queueTypeColor =
                    postQueueType &&
                    "color" in postQueueType &&
                    (typeof (postQueueType as { color?: unknown }).color ===
                      "string" ||
                      (postQueueType as { color?: unknown }).color === null)
                      ? (postQueueType as { color: string | null }).color
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
                      className="bg-card dark:border-border border-border rounded-lg border bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3">
                        {hasFileUrl && firstImageUrl ? (
                          <img
                            src={firstImageUrl}
                            alt="Post preview"
                            className="h-48 w-full rounded object-cover"
                          />
                        ) : (
                          <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-48 w-full items-center justify-center rounded text-xs font-medium">
                            TEXT POST
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <p className="dark:text-foreground text-muted-foreground line-clamp-3 text-sm">
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
                        <span className="dark:text-muted-foreground text-muted-foreground text-xs">
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
                          className="text-primary hover:text-primary/90 dark:text-muted-foreground dark:hover:text-foreground text-xs"
                        >
                          View Original
                        </Link>
                        <button
                          onClick={() => handleRemovePost(postId)}
                          disabled={removePostFetcher.state !== "idle"}
                          className="border-destructive text-destructive hover:bg-destructive/10 dark:border-destructive dark:text-destructive dark:hover:bg-destructive/10 rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {removePostFetcher.state !== "idle"
                            ? "..."
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  );
                })
                .filter((item): item is React.ReactElement => item !== null)
            : null}
        </div>
      )}
    </div>
  );
}
