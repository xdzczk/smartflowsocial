import type { AssetType } from "@prisma/client";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Asset } from "~/features/assets";
import { requireUserId } from "~/features/auth";
import {
  handleNewPostAction,
  loadNewPostData,
  convertJsonValueToScheduleConfig,
  type QueueType,
  type HashTagPreset,
} from "~/features/posts/server";
import {
  MediaPost,
  NewPostHeader,
  NewPostImagesConfirmation,
  TextPost,
  useNewPostState,
} from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const data = await loadNewPostData(userId);
    return json(data);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId or requireAnySubscription), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    // Provide default data structure matching what the component expects
    return handleLoaderError(error, {
      scheduleIntervals: [],
      queueTypes: [],
      hashTagPresets: [],
      assets: [],
    });
  }
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      return await handleNewPostAction(userId, request);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default function NewPost() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Remix loader data type is complex, validated at runtime
  const loaderDataRaw = useLoaderData<typeof loader>();
  // Type assertion to avoid unsafe assignment errors
  const loaderData = loaderDataRaw as {
    queueTypes?: unknown;
    hashTagPresets?: unknown;
    assets?: unknown;
  };
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

  // Type assertions for Remix JsonifyObject serialization
  const typedQueueTypes: Array<string | QueueType> = Array.isArray(queueTypes)
    ? queueTypes.map((qt: unknown) => {
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
      })
    : [];
  const typedHashTagPresets: HashTagPreset[] = Array.isArray(hashTagPresets)
    ? hashTagPresets
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
        .map(
          (preset: {
            id: string;
            name: string;
            tags: string;
            description?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
            userId?: unknown;
          }) => ({
            id: preset.id,
            name: preset.name,
            tags: preset.tags,
            description:
              preset.description === null
                ? null
                : typeof preset.description === "string"
                  ? preset.description
                  : undefined,
            userId:
              typeof preset.userId === "string" ? preset.userId : undefined,
            createdAt: (() => {
              const createdAtValue: unknown = preset.createdAt;
              if (createdAtValue === null || createdAtValue === undefined)
                return;
              if (createdAtValue instanceof Date) return createdAtValue;
              if (typeof createdAtValue === "string")
                return new Date(createdAtValue);
              return;
            })(),
            updatedAt: (() => {
              const updatedAtValue: unknown = preset.updatedAt;
              if (updatedAtValue === null || updatedAtValue === undefined)
                return;
              if (updatedAtValue instanceof Date) return updatedAtValue;
              if (typeof updatedAtValue === "string")
                return new Date(updatedAtValue);
              return;
            })(),
          })
        )
    : [];
  const typedAssets: Asset[] = Array.isArray(assets)
    ? assets
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
          title:
            typeof asset.title === "string"
              ? asset.title
              : asset.title === null
                ? null
                : null,
          content:
            typeof asset.content === "string"
              ? asset.content
              : asset.content === null
                ? null
                : null,
          fileUrl:
            typeof asset.fileUrl === "string"
              ? asset.fileUrl
              : asset.fileUrl === null
                ? null
                : null,
          tags: Array.isArray(asset.tags)
            ? asset.tags.filter((tag): tag is string => typeof tag === "string")
            : [],
          assetType: (typeof asset.assetType === "string"
            ? asset.assetType
            : "IMAGE") as AssetType,
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
              setPreparedImageEvent={(data) => {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: type narrowing for callback data
                if (data && Array.isArray(data) && data.length > 0) {
                  const firstItem = data[0];

                  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for serialized data */
                  if (
                    firstItem &&
                    typeof firstItem === "object" &&
                    firstItem !== null &&
                    "content" in firstItem
                  ) {
                    const content = firstItem.content;
                    if (
                      content &&
                      typeof content === "object" &&
                      content !== null &&
                      "fileUrl" in content &&
                      "scheduledFor" in content &&
                      "caption" in content &&
                      "queueType" in content
                    ) {
                      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
                      const fileUrl =
                        typeof content.fileUrl === "string"
                          ? content.fileUrl
                          : "";
                      const scheduledFor =
                        typeof content.scheduledFor === "string"
                          ? parseInt(content.scheduledFor, 10)
                          : typeof content.scheduledFor === "number"
                            ? content.scheduledFor
                            : 0;
                      const caption =
                        typeof content.caption === "string"
                          ? content.caption
                          : "";
                      const queueType =
                        typeof content.queueType === "string"
                          ? content.queueType
                          : "unassigned";
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
                    } else {
                      setPreparedImageEvent(null);
                    }
                  } else {
                    setPreparedImageEvent(null);
                  }
                } else {
                  setPreparedImageEvent(null);
                }
              }}
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
    </div>
  );
}
