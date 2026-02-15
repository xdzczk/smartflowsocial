import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { Trash2 } from "lucide-react";
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
import type { HashTagPreset, QueueType } from "~/features/posts/types";
import {
  NewPostHeader,
  UnifiedComposer,
  LongFormPost,
  convertJsonValueToScheduleConfig,
} from "~/features/posts/ui";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

type LoaderData = unknown;
type Template = Record<string, unknown> & {
  name?: string;
  createdAt?: string | Date;
  templateType?: string;
  post?: unknown;
  longFormPost?: unknown;
};

function parseQueueType(qt: unknown): string | QueueType {
  if (typeof qt === "string") return qt;
  if (
    typeof qt === "object" &&
    qt !== null &&
    "id" in qt &&
    "name" in qt &&
    typeof (qt as { id: unknown; name: unknown }).id === "string" &&
    typeof (qt as { id: unknown; name: unknown }).name === "string"
  ) {
    const o = qt as { id: string; name: string; [key: string]: unknown };
    const result: QueueType = {
      id: o.id,
      name: o.name,
      scheduleConfig: convertJsonValueToScheduleConfig(o["scheduleConfig"]),
    };
    return result;
  }
  return qt as string | QueueType;
}

function parseHashTagPreset(preset: unknown): HashTagPreset | null {
  if (
    typeof preset === "object" &&
    preset !== null &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset &&
    typeof (preset as { id: unknown }).id === "string" &&
    typeof (preset as { name: unknown }).name === "string" &&
    typeof (preset as { tags: unknown }).tags === "string"
  ) {
    const p = preset as { id: string; name: string; tags: string };
    return { id: p.id, name: p.name, tags: p.tags };
  }
  return null;
}

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

  const rawData = typeof data === "object" && data !== null ? data : {};
  const postContext = (rawData as { postContext?: unknown }).postContext;
  const longformContext = (rawData as { longformContext?: unknown })
    .longformContext;
  const hasPostContext =
    typeof postContext === "object" &&
    postContext !== null &&
    template?.post &&
    template.templateType === "POST";
  const hasLongformContext =
    typeof longformContext === "object" &&
    longformContext !== null &&
    template?.longFormPost &&
    template.templateType === "LONGFORM";

  // All hooks must be called before any early returns
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

      {/* Header: title and meta (template name is edited inside the composer) */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit template</h1>
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
      ) : hasPostContext && typeof postContext === "object" ? (
        (() => {
          const ctx = postContext as {
            queueTypes?: unknown[];
            hashTagPresets?: unknown[];
            initialDraft?: {
              content: string;
              caption: string;
              fileUrl: string[];
              queueType: string;
              queueTypeId: string | null;
              tags: string;
              draftMeta?: {
                attachmentMeta?: Array<{
                  localId: string;
                  url: string;
                  alt?: string;
                }>;
              } | null;
              hashTagPresetId: string | null;
            } | null;
          };
          const queueTypesRaw = Array.isArray(ctx.queueTypes)
            ? ctx.queueTypes
            : [];
          const hashTagPresetsRaw = Array.isArray(ctx.hashTagPresets)
            ? ctx.hashTagPresets
            : [];
          const typedQueueTypes = queueTypesRaw.map((qt) => parseQueueType(qt));
          const typedHashTagPresets = hashTagPresetsRaw
            .map((p) => parseHashTagPreset(p))
            .filter((p): p is HashTagPreset => p !== null);
          const post = template.post as { id: string };
          const templateId = (template as { id?: string }).id ?? "";
          const postId =
            typeof post.id === "string" ? post.id : String(post.id);

          return (
            <>
              <NewPostHeader status="Draft" relayCount={0} />
              <UnifiedComposer
                mode="template"
                queueTypes={typedQueueTypes}
                hashTagPresets={typedHashTagPresets}
                initialDraft={
                  ctx.initialDraft
                    ? {
                        ...ctx.initialDraft,
                        draftMeta: ctx.initialDraft.draftMeta ?? null,
                      }
                    : null
                }
                initialDraftId={null}
                editTemplateContext={{
                  templateId,
                  postId,
                }}
                initialTemplateName={(template as { name?: string }).name ?? ""}
              />
            </>
          );
        })()
      ) : hasLongformContext && typeof longformContext === "object" ? (
        (() => {
          const ctx = longformContext as {
            queueTypes?: unknown[];
            scheduleIntervals?: unknown[];
            hashTagPresets?: unknown[];
            userTimezone?: string;
            uploadProvider?: string | null;
            tags?: string;
            initialTemplateData?: {
              title?: string;
              summary?: string;
              content?: string;
              image?: string;
              tags?: string[];
              queueType?: { name: string };
            } | null;
          };
          const queueTypesRaw = Array.isArray(ctx.queueTypes)
            ? ctx.queueTypes
            : [];
          const scheduleIntervalsRaw = Array.isArray(ctx.scheduleIntervals)
            ? ctx.scheduleIntervals
            : [];
          const scheduleIntervals = scheduleIntervalsRaw
            .map((s: unknown) => {
              if (typeof s === "number") return s;
              if (typeof s === "string") {
                const n = parseFloat(s);
                return Number.isNaN(n) ? null : n;
              }
              return null;
            })
            .filter((n): n is number => n !== null);
          const hashTagPresetsRaw = Array.isArray(ctx.hashTagPresets)
            ? ctx.hashTagPresets
            : [];
          const typedHashTagPresets = hashTagPresetsRaw
            .map((p) => parseHashTagPreset(p))
            .filter((p): p is HashTagPreset => p !== null);
          const lf = template.longFormPost as { id: string } | null;
          const longFormPostId = lf && typeof lf.id === "string" ? lf.id : "";
          const templateId = (template as { id?: string }).id ?? "";
          const initialTemplateData = ctx.initialTemplateData ?? null;
          const initialData = initialTemplateData
            ? {
                id: longFormPostId,
                title: initialTemplateData.title ?? "",
                summary: initialTemplateData.summary ?? "",
                content: initialTemplateData.content ?? "",
                image: initialTemplateData.image ?? "",
                tags: Array.isArray(initialTemplateData.tags)
                  ? initialTemplateData.tags
                  : [],
                queueType: initialTemplateData.queueType ?? {
                  name: "unassigned",
                },
              }
            : undefined;

          const typedQueueTypes = queueTypesRaw.map((qt) => parseQueueType(qt));

          return (
            <LongFormPost
              mode="template"
              queueTypes={typedQueueTypes}
              scheduleIntervals={scheduleIntervals}
              userTags={ctx.tags ?? ""}
              userTimezone={ctx.userTimezone ?? "Etc/GMT"}
              uploadProvider={ctx.uploadProvider ?? null}
              hashTagPresets={typedHashTagPresets}
              initialData={initialData ?? null}
              onPreview={() => {}}
              editTemplateContext={{
                templateId,
                longFormPostId,
              }}
              initialTemplateName={(template as { name?: string }).name ?? ""}
            />
          );
        })()
      ) : null}
    </div>
  );
}
