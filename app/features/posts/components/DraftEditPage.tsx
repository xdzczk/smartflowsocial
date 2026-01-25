import { Link, useLoaderData } from "@remix-run/react";

import { validateUserData } from "~/lib/validation/user-data";

import { fromPostDTO, type PostDTO } from "../dtos";
import { useDraftEditState } from "../hooks/useDraftEditState";
import { convertJsonValueToScheduleConfig } from "../types";
import type { HashTagPreset, QueueType } from "../types";

import { DraftEditForm } from "./DraftEditForm";
import { DraftPreview } from "./DraftPreview";
import { ResumeModal } from "./ResumeModal";

export default function DraftEditPage() {
  const loaderData = useLoaderData<unknown>();

  const postRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "post" in loaderData
      ? (loaderData as { post?: unknown }).post
      : null;
  const userRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "user" in loaderData
      ? (loaderData as { user?: unknown }).user
      : null;
  const queueTypesRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "queueTypes" in loaderData &&
    Array.isArray((loaderData as { queueTypes?: unknown }).queueTypes)
      ? (loaderData as { queueTypes: unknown[] }).queueTypes
      : [];
  const hashTagPresetsRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "hashTagPresets" in loaderData &&
    Array.isArray((loaderData as { hashTagPresets?: unknown }).hashTagPresets)
      ? (loaderData as { hashTagPresets: unknown[] }).hashTagPresets
      : [];

  const typedPost =
    postRaw && typeof postRaw === "object"
      ? fromPostDTO(postRaw as PostDTO)
      : null;
  const typedUser =
    userRaw && typeof userRaw === "object" ? validateUserData(userRaw) : null;

  const typedQueueTypes: QueueType[] = queueTypesRaw
    .filter(
      (
        qt: unknown
      ): qt is {
        id: string;
        name: string;
        scheduleConfig?: unknown;
      } =>
        typeof qt === "object" &&
        qt != null &&
        "id" in qt &&
        "name" in qt &&
        typeof (qt as { id: unknown; name: unknown }).id === "string" &&
        typeof (qt as { id: unknown; name: unknown }).name === "string"
    )
    .map((qt) => {
      const raw = qt as {
        id: string;
        name: string;
        color?: unknown;
        description?: unknown;
        scheduleType?: unknown;
        scheduleConfig?: unknown;
        isEnabled?: unknown;
        userId?: unknown;
      };
      return {
        id: raw.id,
        name: raw.name,
        color: typeof raw.color === "string" ? raw.color : undefined,
        description:
          typeof raw.description === "string" ? raw.description : undefined,
        scheduleType:
          typeof raw.scheduleType === "string" &&
          (raw.scheduleType === "INTERVAL" ||
            raw.scheduleType === "FIXED_SLOTS")
            ? raw.scheduleType
            : undefined,
        scheduleConfig: convertJsonValueToScheduleConfig(raw.scheduleConfig),
        isEnabled:
          typeof raw.isEnabled === "boolean" ? raw.isEnabled : undefined,
        userId: typeof raw.userId === "string" ? raw.userId : undefined,
      };
    });

  const typedHashTagPresets: HashTagPreset[] = hashTagPresetsRaw
    .filter(
      (
        preset: unknown
      ): preset is {
        id: string;
        name: string;
        tags: string;
        description?: string | null;
        createdAt?: unknown;
        updatedAt?: unknown;
        userId?: unknown;
      } =>
        typeof preset === "object" &&
        preset !== null &&
        "id" in preset &&
        "name" in preset &&
        "tags" in preset &&
        typeof (preset as { id: unknown; name: unknown; tags: unknown }).id ===
          "string" &&
        typeof (preset as { id: unknown; name: unknown; tags: unknown })
          .name === "string" &&
        typeof (preset as { id: unknown; name: unknown; tags: unknown })
          .tags === "string"
    )
    .map((preset) => ({
      id: preset.id,
      name: preset.name,
      tags: preset.tags,
      description: preset.description,
      userId: typeof preset.userId === "string" ? preset.userId : undefined,
      createdAt:
        typeof preset.createdAt === "string"
          ? new Date(preset.createdAt)
          : undefined,
      updatedAt:
        typeof preset.updatedAt === "string"
          ? new Date(preset.updatedAt)
          : undefined,
    }));

  // All hooks must be called before any early returns
  const {
    content,
    selectedQueue,
    scheduledFor,
    showResumeModal,
    useHashtagPresets,
    selectedHashtagPresetId,
    isSubmitting,
    fetcher: _fetcher,
    setContent,
    setSelectedQueue,
    setScheduledFor,
    setShowResumeModal,
    setUseHashtagPresets,
    handleResumeClick,
    handleSignAndResume,
    handleHashtagPresetSelect,
  } = useDraftEditState({
    post: typedPost
      ? {
          content: typedPost.content ?? null,
          caption: typedPost.caption ?? null,
          queueType: typedPost.queueType
            ? { name: typedPost.queueType.name }
            : null,
          hashTagPresetId: typedPost.hashTagPresetId ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
          fileUrl: typedPost.fileUrl ?? null,
        }
      : {
          content: null,
          caption: null,
          queueType: null,
          hashTagPresetId: null,
          fileUrl: null,
        },
    user: typedUser ?? {
      id: "",
    },
    hashTagPresets: typedHashTagPresets,
  });

  if (!typedPost || !typedUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold dark:text-white">
          Edit Draft
        </h1>
        <Link
          to="/dashboard/drafts"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
        >
          ← Back to Drafts
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DraftPreview
          post={typedPost}
          selectedQueue={selectedQueue}
          queueTypes={typedQueueTypes}
        />

        <DraftEditForm
          post={typedPost}
          content={content}
          caption={typedPost.caption ?? ""}
          selectedQueue={selectedQueue}
          scheduledFor={scheduledFor ?? ""}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId ?? null}
          queueTypes={typedQueueTypes}
          hashTagPresets={typedHashTagPresets}
          isSubmitting={isSubmitting}
          onContentChange={setContent}
          onQueueChange={setSelectedQueue}
          onScheduledForChange={setScheduledFor}
          onHashtagPresetSelect={(presetId: string | null, _hashtags: string) =>
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
            handleHashtagPresetSelect(presetId ?? "", _hashtags ?? "")
          }
          onUseHashtagPresetsChange={setUseHashtagPresets}
          onResumeClick={handleResumeClick}
        />
      </div>

      <ResumeModal
        isOpen={showResumeModal}
        selectedQueue={selectedQueue}
        scheduledFor={scheduledFor ?? ""}
        content={content}
        caption={typedPost.caption ?? ""}
        isSubmitting={isSubmitting}
        onClose={() => setShowResumeModal(false)}
        onConfirm={() => void handleSignAndResume()}
      />
    </div>
  );
}
