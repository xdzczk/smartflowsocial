import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";

import type { Asset } from "~/features/assets";
import { requireUserId } from "~/features/auth";
import {
  ErrorMessage,
  LongFormPost,
  LongFormPreviewModal,
  NewLongFormHeader,
  useNewLongFormState,
  handleNewLongFormAction,
  loadNewLongFormData,
  type QueueType,
  type HashTagPreset,
  convertJsonValueToScheduleConfig,
} from "~/features/posts";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const data = await loadNewLongFormData(userId);
  return json(data);
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    return await handleNewLongFormAction(userId, request);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

type LoaderData = Awaited<ReturnType<typeof loadNewLongFormData>>;
type ActionData = Awaited<ReturnType<typeof action>>;

export default function NewLongFormPost() {
  const loaderData = useLoaderData<LoaderData>();
  const _userId =
    "userId" in loaderData && typeof loaderData.userId === "string"
      ? loaderData.userId
      : "";
  const userTags =
    "tags" in loaderData && typeof loaderData.tags === "string"
      ? loaderData.tags
      : "";
  const scheduleIntervalsRaw =
    "scheduleIntervals" in loaderData ? loaderData.scheduleIntervals : null;
  const queueTypesRaw =
    "queueTypes" in loaderData && Array.isArray(loaderData.queueTypes)
      ? loaderData.queueTypes
      : [];
  const hashTagPresetsRaw =
    "hashTagPresets" in loaderData && Array.isArray(loaderData.hashTagPresets)
      ? loaderData.hashTagPresets
      : [];
  const assetsRaw =
    "assets" in loaderData && Array.isArray(loaderData.assets)
      ? loaderData.assets
      : [];
  const userTimezone =
    "userTimezone" in loaderData ? loaderData.userTimezone : null;
  const uploadProvider =
    "uploadProvider" in loaderData ? loaderData.uploadProvider : null;
  const actionData = useActionData<ActionData>();

  // Type assertions for Remix JsonifyObject serialization
  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw)
    ? scheduleIntervalsRaw
        .map((s: unknown) => {
          if (typeof s === "string") {
            const parsed = parseInt(s, 10);
            return isNaN(parsed) ? null : parsed;
          }
          if (typeof s === "number") {
            return s;
          }
          return null;
        })
        .filter((n): n is number => n !== null)
    : [];
  const assets: Asset[] = Array.isArray(assetsRaw)
    ? assetsRaw
        .filter(
          (
            asset: unknown,
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
            typeof (asset as { id: unknown }).id === "string",
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
          assetType:
            typeof asset.assetType === "string" ? asset.assetType : "IMAGE",
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
              q.scheduleConfig,
            );
            const isEnabled =
              typeof q.isEnabled === "boolean"
                ? q.isEnabled
                : q.isEnabled !== false;
            const userId = typeof q.userId === "string" ? q.userId : "";
            const result: QueueType = {
              id,
              name,
              color: color,
              description: undefined,
              scheduleType: scheduleType,
              scheduleConfig:
                scheduleConfig as unknown as QueueType["scheduleConfig"],
              isEnabled: isEnabled,
              userId,
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
            preset: unknown,
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
              .tags === "string",
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
            if (createdAtValue === null || createdAtValue === undefined)
              return undefined;
            if (createdAtValue instanceof Date) return createdAtValue;
            if (typeof createdAtValue === "string")
              return new Date(createdAtValue);
            return undefined;
          })(),
          updatedAt: (() => {
            const updatedAtValue: unknown = preset.updatedAt;
            if (updatedAtValue === null || updatedAtValue === undefined)
              return undefined;
            if (updatedAtValue instanceof Date) return updatedAtValue;
            if (typeof updatedAtValue === "string")
              return new Date(updatedAtValue);
            return undefined;
          })(),
        }))
    : [];

  // Type guard for userTags
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

  return (
    <div className="p-6">
      <NewLongFormHeader displayedHashtags={displayedHashtags} />

      <ErrorMessage
        error={
          actionData && typeof actionData === "object" && "error" in actionData
            ? (actionData.error as string | undefined)
            : undefined
        }
        success={
          actionData &&
          typeof actionData === "object" &&
          "success" in actionData
            ? (actionData.success as boolean | undefined)
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
          uploadProvider={uploadProvider}
          userTimezone={userTimezone ?? undefined}
          onQueueTypeChange={(name) => void updateDisplayedHashtags(name)}
          onPreview={handlePreview}
          useHashtagPresets={useHashtagPresets}
          onUseHashtagPresetsChange={handleUseHashtagPresetsChange}
          selectedHashtagPresetId={selectedHashtagPresetId ?? undefined}
          selectedHashtags={selectedHashtags}
          onHashtagPresetChange={handleHashtagPresetSelect}
        />
      </Form>

      {/* Preview Modal */}
      <LongFormPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={previewData.title}
        summary={previewData.summary}
        content={previewData.content}
        image={previewData.image}
        displayedHashtags={displayedHashtags}
      />
    </div>
  );
}
