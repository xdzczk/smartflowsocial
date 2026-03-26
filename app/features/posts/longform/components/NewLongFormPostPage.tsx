import {
  Form,
  useActionData,
  useLoaderData,
  useSearchParams,
  useNavigate,
} from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ErrorMessage } from "~/features/posts/components/ErrorMessage";
import PublishResultModal from "~/features/posts/components/PublishResultModal";
import { CreateComposerShell } from "~/features/posts/composer";
import { useNewLongFormState } from "~/features/posts/hooks/useNewLongFormState";
import { refreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import type { HashTagPreset, QueueType } from "~/features/posts/types";
import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "~/features/posts/utils/publish-result.utils";
import { getActionErrorMessage } from "~/lib/errors";

import LongFormPost from "./LongFormPost";
import LongFormPreviewModal from "./LongFormPreviewModal";

export default function NewLongFormPostPage() {
  const loaderData = useLoaderData<unknown>();
  const actionData = useActionData<unknown>();
  const queryClient = useQueryClient();

  const userTags =
    loaderData && typeof loaderData === "object" && "tags" in loaderData
      ? (loaderData as { tags?: unknown }).tags
      : "";
  const scheduleIntervalsRaw =
    loaderData &&
    typeof loaderData === "object" &&
    "scheduleIntervals" in loaderData
      ? (loaderData as { scheduleIntervals?: unknown }).scheduleIntervals
      : null;
  const queueTypesRaw =
    loaderData && typeof loaderData === "object" && "queueTypes" in loaderData
      ? (loaderData as { queueTypes?: unknown }).queueTypes
      : [];
  const hashTagPresetsRaw =
    loaderData &&
    typeof loaderData === "object" &&
    "hashTagPresets" in loaderData
      ? (loaderData as { hashTagPresets?: unknown }).hashTagPresets
      : [];
  const userTimezone =
    loaderData && typeof loaderData === "object" && "userTimezone" in loaderData
      ? (loaderData as { userTimezone?: unknown }).userTimezone
      : null;
  const uploadProvider =
    loaderData &&
    typeof loaderData === "object" &&
    "uploadProvider" in loaderData
      ? (loaderData as { uploadProvider?: unknown }).uploadProvider
      : null;
  const initialTemplateData =
    loaderData &&
    typeof loaderData === "object" &&
    "initialTemplateData" in loaderData &&
    (loaderData as { initialTemplateData?: unknown }).initialTemplateData !==
      null &&
    typeof (loaderData as { initialTemplateData?: unknown })
      .initialTemplateData === "object"
      ? (
          loaderData as {
            initialTemplateData: {
              title?: string;
              summary?: string;
              content?: string;
              image?: string;
              tags?: string[];
              queueType?: { name: string };
            };
          }
        ).initialTemplateData
      : null;
  const templatesRaw =
    loaderData &&
    typeof loaderData === "object" &&
    "templates" in loaderData &&
    Array.isArray((loaderData as { templates?: unknown }).templates)
      ? (
          loaderData as {
            templates: Array<{ id: string; name: string | null }>;
          }
        ).templates
      : [];

  // Type assertions for Remix JsonifyObject serialization (0.25 = 15 min, 0.5 = 30 min; parse as float)
  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw)
    ? scheduleIntervalsRaw
        .map((s: unknown) => {
          if (typeof s === "string") {
            const parsed = parseFloat(s);
            return Number.isNaN(parsed) ? null : parsed;
          }
          if (typeof s === "number") return s;
          return null;
        })
        .filter((n): n is number => n !== null)
    : [];

  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (
            qt &&
            typeof qt === "object" &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
            qt !== null &&
            "id" in qt &&
            "name" in qt
          ) {
            const q = qt as {
              id?: unknown;
              name?: unknown;
              colorToken?: unknown;
              scheduleType?: unknown;
              scheduleConfig?: unknown;
              isEnabled?: unknown;
              userId?: unknown;
            };
            const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
            const name =
              typeof q.name === "string" ? q.name : String(q.name ?? "");
            const color = getQueueAccentHex(
              q.colorToken !== null &&
                q.colorToken !== undefined &&
                typeof q.colorToken === "string"
                ? q.colorToken
                : null
            );
            const colorToken =
              q.colorToken !== null &&
              q.colorToken !== undefined &&
              typeof q.colorToken === "string"
                ? q.colorToken
                : null;
            const scheduleType =
              typeof q.scheduleType === "string" &&
              (q.scheduleType === "INTERVAL" ||
                q.scheduleType === "FIXED_SLOTS" ||
                q.scheduleType === "WEEKLY_SLOTS")
                ? q.scheduleType
                : undefined;
            const scheduleConfig = convertJsonValueToScheduleConfig(
              q.scheduleConfig
            );
            const isEnabled =
              typeof q.isEnabled === "boolean"
                ? q.isEnabled
                : q.isEnabled !== false;
            const userIdVal = typeof q.userId === "string" ? q.userId : "";
            const result: QueueType = {
              id,
              name,
              color,
              colorToken: colorToken ?? undefined,
              description: undefined,
              scheduleType: scheduleType,
              scheduleConfig:
                scheduleConfig as unknown as QueueType["scheduleConfig"],
              isEnabled: isEnabled,
              userId: userIdVal,
            };
            return result;
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];

  const hashTagPresets: HashTagPreset[] = Array.isArray(hashTagPresetsRaw)
    ? hashTagPresetsRaw
        .filter(
          (
            preset: unknown
          ): preset is {
            id: string;
            name: string;
            tags: string;
            description?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
            userId?: unknown;
          } =>
            typeof preset === "object" &&
            preset !== null &&
            "id" in preset &&
            "name" in preset &&
            "tags" in preset &&
            typeof (preset as { id: unknown; name: unknown; tags: unknown })
              .id === "string" &&
            typeof (preset as { id: unknown; name: unknown; tags: unknown })
              .name === "string" &&
            typeof (preset as { id: unknown; name: unknown; tags: unknown })
              .tags === "string"
        )
        .map((preset) => ({
          id: preset.id,
          name: preset.name,
          tags: preset.tags,
          description:
            preset.description === null
              ? null
              : typeof preset.description === "string"
                ? preset.description
                : undefined,
          userId: typeof preset.userId === "string" ? preset.userId : undefined,
          createdAt: (() => {
            const createdAtValue: unknown = preset.createdAt;
            if (createdAtValue === null || createdAtValue === undefined) return;
            if (createdAtValue instanceof Date) return createdAtValue;
            if (typeof createdAtValue === "string")
              return new Date(createdAtValue);
            return;
          })(),
          updatedAt: (() => {
            const updatedAtValue: unknown = preset.updatedAt;
            if (updatedAtValue === null || updatedAtValue === undefined) return;
            if (updatedAtValue instanceof Date) return updatedAtValue;
            if (typeof updatedAtValue === "string")
              return new Date(updatedAtValue);
            return;
          })(),
        }))
    : [];

  const safeUserTags = typeof userTags === "string" ? userTags : "";

  const {
    displayedHashtags,
    showPreviewModal,
    setShowPreviewModal,
    previewData,
    useHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtags,
    handleHashtagPresetSelect,
    updateDisplayedHashtags,
    handleUseHashtagPresetsChange,
    handlePreview,
  } = useNewLongFormState({ userTags: safeUserTags });

  const [searchParams, setSearchParams] = useSearchParams();
  const scheduledAt = searchParams.get("scheduledAt");
  const publishResultToken =
    searchParams.get("published") ?? searchParams.get("scheduled");
  const navigate = useNavigate();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | Date | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | Date | null;
  } | null>(null);

  // Check for published/scheduled URL param
  useEffect(() => {
    const publishedPostId = searchParams.get("published");
    const scheduledPostId = searchParams.get("scheduled");
    const postId = publishedPostId ?? scheduledPostId;

    if (postId && !modalPostId && !showPublishModal) {
      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setModalPostId(postId);
      }, 0);

      // Fetch post data using fetch directly for API routes
      void (async () => {
        try {
          const res = await fetch(`/api/posts/${postId}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
          }
          const data = (await res.json()) as {
            post?: {
              id: string;
              publishAttemptId: string | null;
              currentState?: string | null;
              scheduledAtUtc?: string | null;
            };
            longFormPost?: {
              id: string;
              publishAttemptId: string | null;
              currentState?: string | null;
              scheduledAtUtc?: string | null;
            };
            error?: string;
          };

          if (data.post || data.longFormPost) {
            if (scheduledPostId) {
              refreshPostViews(queryClient);
            }
            setTimeout(() => {
              setModalPost(data.post ?? null);
              setModalLongFormPost(data.longFormPost ?? null);
              setShowPublishModal(true);
            }, 0);
            // Clear URL param to prevent re-showing on refresh
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete("published");
            newSearchParams.delete("scheduled");
            setSearchParams(newSearchParams, { replace: true });
          }
        } catch (error) {
          console.error("Failed to fetch post data:", error);
          // Reset state on error
          setTimeout(() => {
            setModalPostId(null);
          }, 0);
        }
      })();
    }
  }, [
    searchParams,
    modalPostId,
    showPublishModal,
    setSearchParams,
    queryClient,
  ]);

  useEffect(() => {
    if (!publishResultToken) return;
    try {
      localStorage.removeItem("longform-draft-new");
    } catch {
      // ignore
    }
  }, [publishResultToken]);

  return (
    <CreateComposerShell
      status="Draft"
      relayCount={0}
      onRelayClick={() => {}}
      contentType="article"
      onContentTypeChange={(next) => {
        if (next === "article") return;
        navigate(`/dashboard/newpost?type=${encodeURIComponent(next)}`);
      }}
      showPublishModeBar={false}
      showPrimaryCta={false}
    >
      {templatesRaw.length > 0 ? (
        <div className="mb-4 flex items-center gap-2">
          <label
            htmlFor="load-template-longform"
            className="text-muted-foreground text-sm"
          >
            Load template:
          </label>
          <select
            id="load-template-longform"
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id)
                navigate(
                  `/dashboard/newlongformpost?templateId=${encodeURIComponent(id)}`
                );
            }}
          >
            <option value="">— Choose —</option>
            {templatesRaw.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? "Unnamed template"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <ErrorMessage
        error={getActionErrorMessage(actionData)}
        success={
          actionData &&
          typeof actionData === "object" &&
          "success" in actionData
            ? ((actionData as { success?: unknown }).success as
                | boolean
                | undefined)
            : undefined
        }
      />

      <Form method="post" encType="multipart/form-data">
        <LongFormPost
          key={`newlongform-composer-${publishResultToken ?? "default"}`}
          initialData={initialTemplateData}
          initialScheduledFor={scheduledAt ?? undefined}
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={safeUserTags}
          hashTagPresets={hashTagPresets}
          uploadProvider={
            typeof uploadProvider === "string" || uploadProvider === null
              ? uploadProvider
              : null
          }
          userTimezone={
            typeof userTimezone === "string" ? userTimezone : undefined
          }
          onQueueTypeChange={(name) => void updateDisplayedHashtags(name)}
          onPreview={handlePreview}
          useHashtagPresets={useHashtagPresets}
          onUseHashtagPresetsChange={handleUseHashtagPresetsChange}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onHashtagPresetChange={handleHashtagPresetSelect}
          skipLocalDraftRestore={Boolean(publishResultToken)}
        />
      </Form>

      <LongFormPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={previewData.title}
        summary={previewData.summary}
        content={previewData.content}
        image={previewData.image}
        displayedHashtags={displayedHashtags}
      />

      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={
            modalPost?.publishAttemptId ??
            modalLongFormPost?.publishAttemptId ??
            null
          }
          action={determineModalAction(modalPost, modalLongFormPost)}
          postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
          scheduledFor={
            modalPost?.scheduledAtUtc ??
            modalLongFormPost?.scheduledAtUtc ??
            null
          }
          onCreateNew={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            try {
              localStorage.removeItem("longform-draft-new");
            } catch {
              // ignore
            }
            navigate(getNewPostUrl(postType));
          }}
          onGoToDashboard={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            navigate("/dashboard");
          }}
          onViewPage={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            const action = determineModalAction(modalPost, modalLongFormPost);

            if (action === "schedule") {
              // Navigate to scheduled page
              if (postType === "longform") {
                navigate("/dashboard/scheduled?tab=longform");
              } else {
                navigate("/dashboard/scheduled");
              }
            } else {
              // Navigate to posted page
              if (postType === "longform") {
                navigate("/dashboard/published?tab=longform");
              } else {
                navigate("/dashboard/published");
              }
            }
          }}
        />
      ) : null}
    </CreateComposerShell>
  );
}
