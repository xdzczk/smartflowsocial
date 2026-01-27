import type { AssetType } from "@prisma/client";
import { useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Asset } from "~/features/assets";
import {
  convertJsonValueToScheduleConfig,
  type HashTagPreset,
  type PreparedEvent,
  type QueueType,
} from "~/features/posts/types";
import {
  MediaPost,
  NewPostHeader,
  NewPostImagesConfirmation,
  PublishResultModal,
  TextPost,
} from "~/features/posts/ui";

import { useNewPostState } from "../hooks/useNewPostState";
import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "../utils/publish-result.utils";

// ============================================================================
// Loader Data Parsing Helpers (route-safe, no server imports)
// ============================================================================

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
    const queueTypeObj = qt as {
      id: string;
      name: string;
      scheduleConfig?: unknown;
      [key: string]: unknown;
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Type assertion needed for Remix loader data structure
    return {
      id: queueTypeObj.id,
      name: queueTypeObj.name,
      color:
        typeof queueTypeObj["color"] === "string"
          ? queueTypeObj["color"]
          : undefined,
      description:
        typeof queueTypeObj["description"] === "string"
          ? queueTypeObj["description"]
          : undefined,
      scheduleType:
        typeof queueTypeObj["scheduleType"] === "string" &&
        (queueTypeObj["scheduleType"] === "INTERVAL" ||
          queueTypeObj["scheduleType"] === "FIXED_SLOTS")
          ? queueTypeObj["scheduleType"]
          : undefined,
      scheduleConfig: convertJsonValueToScheduleConfig(
        queueTypeObj.scheduleConfig
      ),
      isEnabled:
        typeof queueTypeObj["isEnabled"] === "boolean"
          ? queueTypeObj["isEnabled"]
          : undefined,
      userId:
        typeof queueTypeObj["userId"] === "string"
          ? queueTypeObj["userId"]
          : undefined,
    } as QueueType;
  }
  return qt as string | QueueType;
}

function parseDateValue(dateValue: unknown): Date | undefined {
  if (dateValue === null || dateValue === undefined) return;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === "string") return new Date(dateValue);
  return;
}

function parseHashTagPreset(preset: unknown): HashTagPreset | null {
  if (
    typeof preset === "object" &&
    preset !== null &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).id ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).name ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).tags ===
      "string"
  ) {
    const typedPreset = preset as {
      id: string;
      name: string;
      tags: string;
      description?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
      userId?: unknown;
    };
    return {
      id: typedPreset.id,
      name: typedPreset.name,
      tags: typedPreset.tags,
      description:
        typedPreset.description === null
          ? null
          : typeof typedPreset.description === "string"
            ? typedPreset.description
            : undefined,
      userId:
        typeof typedPreset.userId === "string" ? typedPreset.userId : undefined,
      createdAt: parseDateValue(typedPreset.createdAt),
      updatedAt: parseDateValue(typedPreset.updatedAt),
    };
  }
  return null;
}

function parseAsset(asset: unknown): Asset | null {
  if (
    typeof asset === "object" &&
    asset !== null &&
    "id" in asset &&
    typeof (asset as { id: unknown }).id === "string"
  ) {
    const typedAsset = asset as {
      id: string;
      title?: unknown;
      content?: unknown;
      fileUrl?: unknown;
      tags?: unknown;
      assetType?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    return {
      id: typedAsset.id,
      title:
        typeof typedAsset.title === "string"
          ? typedAsset.title
          : typedAsset.title === null
            ? null
            : null,
      content:
        typeof typedAsset.content === "string"
          ? typedAsset.content
          : typedAsset.content === null
            ? null
            : null,
      fileUrl:
        typeof typedAsset.fileUrl === "string"
          ? typedAsset.fileUrl
          : typedAsset.fileUrl === null
            ? null
            : null,
      tags: Array.isArray(typedAsset.tags)
        ? typedAsset.tags.filter(
            (tag): tag is string => typeof tag === "string"
          )
        : [],
      assetType: (typeof typedAsset.assetType === "string"
        ? typedAsset.assetType
        : "IMAGE") as AssetType,
      createdAt: (() => {
        const createdAtValue: unknown = typedAsset.createdAt;
        if (createdAtValue instanceof Date) return createdAtValue;
        if (typeof createdAtValue === "string") return new Date(createdAtValue);
        return new Date();
      })(),
      updatedAt: (() => {
        const updatedAtValue: unknown = typedAsset.updatedAt;
        if (updatedAtValue instanceof Date) return updatedAtValue;
        if (typeof updatedAtValue === "string") return new Date(updatedAtValue);
        return new Date();
      })(),
    };
  }
  return null;
}

function handlePreparedImageEventData(
  data: unknown,
  setPreparedImageEvent: (event: PreparedEvent | null) => void
): void {
  if (!data || !Array.isArray(data) || data.length === 0) {
    setPreparedImageEvent(null);
    return;
  }

  const firstItem = data[0] as { content?: unknown } | undefined;
  if (
    !firstItem ||
    typeof firstItem !== "object" ||
    !("content" in firstItem)
  ) {
    setPreparedImageEvent(null);
    return;
  }

  const firstItemContent = (firstItem as { content: unknown }).content;
  if (
    !firstItemContent ||
    typeof firstItemContent !== "object" ||
    !("fileUrl" in firstItemContent) ||
    !("scheduledFor" in firstItemContent) ||
    !("caption" in firstItemContent) ||
    !("queueType" in firstItemContent)
  ) {
    setPreparedImageEvent(null);
    return;
  }

  const content = firstItemContent as {
    fileUrl: unknown;
    scheduledFor: unknown;
    caption: unknown;
    queueType: unknown;
  };

  const fileUrl = typeof content.fileUrl === "string" ? content.fileUrl : "";
  const scheduledFor =
    typeof content.scheduledFor === "string"
      ? parseInt(content.scheduledFor, 10)
      : typeof content.scheduledFor === "number"
        ? content.scheduledFor
        : 0;
  const caption = typeof content.caption === "string" ? content.caption : "";
  const queueType =
    typeof content.queueType === "string" ? content.queueType : "unassigned";

  setPreparedImageEvent({
    fileUrl,
    scheduledFor,
    caption,
    queueType,
    isRecyclable: false,
    events: {
      content: "",
      created_at: 0,
      kind: 1,
      tags: [],
    },
  });
}

export default function NewPostPage() {
  const loaderDataRaw = useLoaderData<unknown>();
  const loaderData =
    loaderDataRaw && typeof loaderDataRaw === "object"
      ? (loaderDataRaw as {
          queueTypes?: unknown;
          hashTagPresets?: unknown;
          assets?: unknown;
        })
      : {};

  const queueTypes =
    "queueTypes" in loaderData && Array.isArray(loaderData.queueTypes)
      ? loaderData.queueTypes
      : [];
  const hashTagPresets =
    "hashTagPresets" in loaderData && Array.isArray(loaderData.hashTagPresets)
      ? loaderData.hashTagPresets
      : [];
  const assets =
    "assets" in loaderData && Array.isArray(loaderData.assets)
      ? loaderData.assets
      : [];

  const typedQueueTypes: Array<string | QueueType> = Array.isArray(queueTypes)
    ? queueTypes.map((qt) => parseQueueType(qt))
    : [];
  const typedHashTagPresets: HashTagPreset[] = Array.isArray(hashTagPresets)
    ? hashTagPresets
        .map((p) => parseHashTagPreset(p))
        .filter((p): p is HashTagPreset => p !== null)
    : [];
  const typedAssets: Asset[] = Array.isArray(assets)
    ? assets.map((a) => parseAsset(a)).filter((a): a is Asset => a !== null)
    : [];

  const {
    files,
    setFiles,
    selectedQueueType,
    selectedHashTagPresetId,
    selectedHashtags,
    showImagePreview,
    setShowImagePreview,
    preparedImageEvent,
    setPreparedImageEvent,
    handleQueueTypeChange,
    handleHashtagPresetSelect,
  } = useNewPostState();

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
      <NewPostHeader selectedHashtags={selectedHashtags} />

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text">Text Post</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>
        <TabsContent value="text">
          <TextPost
            queueTypes={typedQueueTypes}
            assets={typedAssets}
            hashTagPresets={typedHashTagPresets}
            onQueueTypeChange={handleQueueTypeChange}
            selectedHashTagPresetId={selectedHashTagPresetId}
            onHashtagPresetChange={(
              presetId: string | null,
              _hashtags: string
            ) =>
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: presetId can be null
              handleHashtagPresetSelect(presetId ?? "", _hashtags ?? "")
            }
          />
        </TabsContent>
        <TabsContent value="media">
          {showImagePreview ? (
            <NewPostImagesConfirmation
              preparedEvents={
                preparedImageEvent
                  ? [
                      {
                        content: {
                          fileUrl: preparedImageEvent.fileUrl,
                          scheduledFor: String(preparedImageEvent.scheduledFor),
                          caption: preparedImageEvent.caption,
                          queueType: preparedImageEvent.queueType,
                        },
                        type: "media" as const,
                        queueType: preparedImageEvent.queueType,
                      },
                    ]
                  : []
              }
              onCancel={() => setShowImagePreview(false)}
              postsCount={1}
              tags={selectedHashTagPresetId ?? ""}
            />
          ) : (
            <MediaPost
              files={files}
              setFiles={setFiles}
              setShowImagePreview={setShowImagePreview}
              setPreparedImageEvent={(data) =>
                handlePreparedImageEventData(data, setPreparedImageEvent)
              }
              queueTypes={typedQueueTypes}
              hashTagPresets={typedHashTagPresets}
              selectedQueueType={selectedQueueType}
              onQueueTypeChange={handleQueueTypeChange}
              selectedHashTagPresetId={selectedHashTagPresetId}
              onHashtagPresetChange={handleHashtagPresetSelect}
            />
          )}
        </TabsContent>
      </Tabs>

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
