import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

type LoaderData = unknown;
type Template = Record<string, unknown> & {
  name?: string;
  createdAt?: string | Date;
  templateType?: string;
  post?: unknown;
  longFormPost?: unknown;
};

export default function TemplateEditPage() {
  const { formatDate } = useFormattedDate();
  const navigate = useNavigate();
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
  const deleteTemplateFetcher = useFetcher<{
    success?: boolean;
    redirectTo?: string;
  }>();
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

  // After successful delete, navigate to templates list (redirect from fetcher doesn't navigate)
  useEffect(() => {
    const fetcherData = deleteTemplateFetcher.data;
    if (
      fetcherData &&
      typeof fetcherData === "object" &&
      !Array.isArray(fetcherData) &&
      "redirectTo" in fetcherData &&
      typeof fetcherData.redirectTo === "string"
    ) {
      navigate(fetcherData.redirectTo);
    }
  }, [deleteTemplateFetcher.data, navigate]);

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
          {template.templateType === "POST" && template.post ? (
            <button
              onClick={handleScheduleTemplate}
              disabled={scheduleFetcher.state !== "idle"}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {scheduleFetcher.state !== "idle" ? "Loading..." : "Schedule"}
            </button>
          ) : null}
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
                aria-label="Edit name"
              >
                <Pencil
                  className={INLINE_ICON_SIZE_CLASS}
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </button>
            </div>
          )}
        </div>
        <p className="dark:text-muted-foreground text-muted-foreground text-sm">
          {template.templateType === "LONGFORM" ? "1 article" : "1 post"} •
          Created{" "}
          {(template as { createdAt?: unknown }).createdAt
            ? formatDate((template as { createdAt: string | Date }).createdAt)
            : "Unknown"}
        </p>
      </div>

      {!template.post && !template.longFormPost ? (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md">
            <Trash2
              className="text-foreground mx-auto h-12 w-12"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            <h3 className="dark:text-foreground text-foreground mt-4 text-lg font-medium">
              No content in this template
            </h3>
            <p className="dark:text-muted-foreground text-muted-foreground mt-2 text-sm">
              This template is empty. You can delete it or go back.
            </p>
          </div>
        </div>
      ) : template.templateType === "LONGFORM" && template.longFormPost ? (
        <div className="rounded-lg border p-4">
          <p className="dark:text-muted-foreground text-muted-foreground mb-2 text-sm">
            Article template
          </p>
          <Link
            to={`/dashboard/longform/${(() => {
              const lf = template.longFormPost;
              /* eslint-disable @typescript-eslint/no-unnecessary-condition -- runtime guard for loader data shape */
              if (
                lf &&
                typeof lf === "object" &&
                lf !== null &&
                "id" in lf &&
                typeof (lf as { id?: string }).id === "string"
              )
                return (lf as { id: string }).id;
              /* eslint-enable @typescript-eslint/no-unnecessary-condition */
              return "";
            })()}/edit`}
            className="text-primary hover:underline"
          >
            Edit article →
          </Link>
        </div>
      ) : template.post ? (
        (() => {
          const post = template.post as Record<string, unknown>;
          /* eslint-disable @typescript-eslint/no-unnecessary-condition -- runtime guard for loader data */
          if (!post || typeof post !== "object" || !("id" in post)) return null;
          /* eslint-enable @typescript-eslint/no-unnecessary-condition */
          const _postId =
            typeof post["id"] === "string"
              ? post["id"]
              : String(post["id"] ?? "");
          const postFileUrl = post["fileUrl"];
          const postCaption =
            typeof post["caption"] === "string" ? post["caption"] : "";
          const postQueueType =
            post["queueType"] &&
            typeof post["queueType"] === "object" &&
            !Array.isArray(post["queueType"])
              ? (post["queueType"] as Record<string, unknown>)
              : null;
          const postPostedAt = post["publishedAt"];
          const postSignedEvent =
            post["signedEvent"] &&
            typeof post["signedEvent"] === "object" &&
            !Array.isArray(post["signedEvent"])
              ? (post["signedEvent"] as Record<string, unknown>)
              : null;
          const signedEventId =
            postSignedEvent && typeof postSignedEvent["id"] === "string"
              ? postSignedEvent["id"]
              : "";
          const queueTypeName =
            postQueueType && typeof postQueueType["name"] === "string"
              ? postQueueType["name"]
              : "unassigned";
          const queueTypeColorToken =
            postQueueType && typeof postQueueType["colorToken"] === "string"
              ? postQueueType["colorToken"]
              : null;
          const hasFileUrl =
            postFileUrl &&
            (Array.isArray(postFileUrl)
              ? postFileUrl.length > 0
              : typeof postFileUrl === "string" && postFileUrl.length > 0);
          const fileUrlArray = Array.isArray(postFileUrl)
            ? postFileUrl
            : typeof postFileUrl === "string"
              ? [postFileUrl]
              : [];
          const firstImageUrl =
            fileUrlArray.length > 0 ? getImageUrls(fileUrlArray)[0] : "";

          return (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="bg-card dark:border-border border-border rounded-lg border bg-white p-4 shadow-sm">
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
                            queueTypeColorToken
                          );
                          return `${colors.bg} ${colors.text}`;
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
                {signedEventId ? (
                  <Link
                    to={`https://primal.net/e/${signedEventId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:text-primary/90 dark:text-muted-foreground dark:hover:text-foreground text-xs"
                  >
                    View Original
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
