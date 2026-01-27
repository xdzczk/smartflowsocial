import type { AssetType } from "@prisma/client";
import {
  Form,
  useActionData,
  useLoaderData,
  useSearchParams,
  useNavigate,
} from "@remix-run/react";
import { useEffect, useState } from "react";

import type { Asset } from "~/features/assets";

import { useNewLongFormState } from "../hooks/useNewLongFormState";
import { convertJsonValueToScheduleConfig } from "../types";
import type { HashTagPreset, QueueType } from "../types";
import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "../utils/publish-result.utils";

import { ErrorMessage } from "./ErrorMessage";
import LongFormPost from "./LongFormPost";
import LongFormPreviewModal from "./LongFormPreviewModal";
import { NewLongFormHeader } from "./NewLongFormHeader";
import PublishResultModal from "./PublishResultModal";

export default function NewLongFormPostPage() {
  const loaderData = useLoaderData<unknown>();
  const actionData = useActionData<unknown>();

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
  const assetsRaw =
    loaderData && typeof loaderData === "object" && "assets" in loaderData
      ? (loaderData as { assets?: unknown }).assets
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

  // Type assertions for Remix JsonifyObject serialization
  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw)
    ? scheduleIntervalsRaw
        .map((s: unknown) => {
          if (typeof s === "string") {
            const parsed = parseInt(s, 10);
            return isNaN(parsed) ? null : parsed;
          }
          if (typeof s === "number") return s;
          return null;
        })
        .filter((n): n is number => n !== null)
    : [];

  const assets: Asset[] = Array.isArray(assetsRaw)
    ? assetsRaw
        .filter(
          (
            asset: unknown
          ): asset is {
            id: string;
            title?: unknown;
            content?: unknown;
            fileUrl?: unknown;
            tags?: unknown;
            assetType?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
          } =>
            typeof asset === "object" &&
            asset !== null &&
            "id" in asset &&
            typeof (asset as { id: unknown }).id === "string"
        )
        .map((asset) => ({
          id: asset.id,
          title: typeof asset.title === "string" ? asset.title : null,
          content: typeof asset.content === "string" ? asset.content : null,
          fileUrl: typeof asset.fileUrl === "string" ? asset.fileUrl : null,
          tags: Array.isArray(asset.tags)
            ? asset.tags.filter((tag): tag is string => typeof tag === "string")
            : [],
          assetType:
            typeof asset.assetType === "string"
              ? (asset.assetType as AssetType)
              : ("IMAGE" as AssetType),
          createdAt: (() => {
            const createdAtValue: unknown = asset.createdAt;
            if (createdAtValue instanceof Date) return createdAtValue;
            if (typeof createdAtValue === "string")
              return new Date(createdAtValue);
            return new Date();
          })(),
          updatedAt: (() => {
            const updatedAtValue: unknown = asset.updatedAt;
            if (updatedAtValue instanceof Date) return updatedAtValue;
            if (typeof updatedAtValue === "string")
              return new Date(updatedAtValue);
            return new Date();
          })(),
        }))
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
              color?: unknown;
              scheduleType?: unknown;
              scheduleConfig?: unknown;
              isEnabled?: unknown;
              userId?: unknown;
            };
            const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
            const name =
              typeof q.name === "string" ? q.name : String(q.name ?? "");
            const color =
              q.color !== null && q.color !== undefined
                ? typeof q.color === "string"
                  ? q.color
                  : String(q.color)
                : null;
            const scheduleType =
              typeof q.scheduleType === "string" &&
              (q.scheduleType === "INTERVAL" ||
                q.scheduleType === "FIXED_SLOTS")
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
              color: color,
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
  const navigate = useNavigate();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
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
            };
            longFormPost?: {
              id: string;
              publishAttemptId: string | null;
              currentState?: string | null;
            };
            error?: string;
          };

          if (data.post || data.longFormPost) {
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
  }, [searchParams, modalPostId, showPublishModal, setSearchParams]);

  return (
    <div className="p-6">
      <NewLongFormHeader displayedHashtags={displayedHashtags} />

      <ErrorMessage
        error={
          actionData && typeof actionData === "object" && "error" in actionData
            ? ((actionData as { error?: unknown }).error as string | undefined)
            : undefined
        }
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
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={safeUserTags}
          hashTagPresets={hashTagPresets}
          assets={assets}
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
          onCreateNew={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            navigate(getNewPostUrl(postType));
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
                navigate("/dashboard/posted?tab=longform");
              } else {
                navigate("/dashboard/posted");
              }
            }
          }}
        />
      ) : null}
    </div>
  );
}
