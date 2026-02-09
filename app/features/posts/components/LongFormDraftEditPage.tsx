import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import type { Asset } from "~/features/assets";
import {
  DraftPickerModal,
  DraftVersionHistory,
  ErrorMessage,
  LongFormEditHeader,
  LongFormPost,
  LongFormPreviewModal,
  useLongFormEditState,
} from "~/features/posts/ui";

export default function LongFormDraftEditPage() {
  const loaderData = useLoaderData<unknown>();

  const post =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "post" in loaderData
      ? (loaderData as { post?: unknown }).post
      : null;

  const userTags =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "tags" in loaderData
      ? typeof (loaderData as { tags?: unknown }).tags === "string"
        ? (loaderData as { tags: string }).tags
        : String((loaderData as { tags?: unknown }).tags ?? "")
      : "";

  const scheduleIntervalsRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "scheduleIntervals" in loaderData
      ? (loaderData as { scheduleIntervals?: unknown }).scheduleIntervals
      : null;

  const queueTypesRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "queueTypes" in loaderData &&
    Array.isArray((loaderData as { queueTypes?: unknown }).queueTypes)
      ? (loaderData as { queueTypes: unknown[] }).queueTypes
      : [];

  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
  const assetsRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "assets" in loaderData &&
    Array.isArray((loaderData as { assets?: unknown }).assets)
      ? ((loaderData as { assets: unknown[] }).assets ?? [])
      : [];
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  const hashtagPresetsRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "hashtagPresets" in loaderData &&
    Array.isArray((loaderData as { hashtagPresets?: unknown }).hashtagPresets)
      ? (loaderData as { hashtagPresets: unknown[] }).hashtagPresets
      : [];

  const actionData = useActionData<unknown>();

  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw)
    ? scheduleIntervalsRaw
        .map((s: unknown) =>
          typeof s === "string"
            ? parseFloat(s)
            : typeof s === "number"
              ? s
              : null
        )
        .filter((n): n is number => n !== null && !Number.isNaN(n))
    : [];

  const assets = assetsRaw.filter(
    (asset: unknown): asset is Asset =>
      typeof asset === "object" &&
      asset != null &&
      "id" in asset &&
      typeof (asset as { id: unknown }).id === "string"
  );

  const typedPost =
    post &&
    typeof post === "object" &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
    post != null &&
    "id" in post &&
    typeof (post as { id: unknown }).id === "string"
      ? (post as {
          id: string;
          title?: string;
          summary?: string;
          content?: string;
          image?: string;
          queueType?: { name: string } | null;
        })
      : null;

  const queueTypes = queueTypesRaw.filter(
    (
      qt: unknown
    ): qt is {
      id: string;
      name: string;
      color?: string | null;
      scheduleType?: string;
      scheduleConfig?: unknown;
      isEnabled?: boolean;
    } =>
      typeof qt === "object" &&
      qt !== null &&
      "id" in qt &&
      "name" in qt &&
      typeof (qt as { id: unknown; name: unknown }).id === "string" &&
      typeof (qt as { id: unknown; name: unknown }).name === "string"
  );

  const versionsRaw =
    typeof loaderData === "object" &&
    loaderData !== null &&
    "versions" in loaderData &&
    Array.isArray((loaderData as { versions?: unknown }).versions)
      ? (loaderData as { versions: unknown[] }).versions
      : [];
  const versions = versionsRaw.filter(
    (
      v: unknown
    ): v is {
      id: string;
      version: number;
      createdAt: string;
      createdBy: string | null;
    } =>
      typeof v === "object" &&
      v !== null &&
      "id" in v &&
      "version" in v &&
      "createdAt" in v &&
      typeof (v as { id: unknown }).id === "string" &&
      typeof (v as { version: unknown }).version === "number" &&
      typeof (v as { createdAt: unknown }).createdAt === "string"
  );

  const hashtagPresets = hashtagPresetsRaw.filter(
    (
      preset: unknown
    ): preset is {
      id: string;
      name: string;
      tags: string;
      description?: string | null;
    } =>
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
  );

  const navigate = useNavigate();
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const {
    displayedHashtags,
    showPreviewModal,
    setShowPreviewModal,
    previewData,
    useHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtags,
    handleHashtagPresetToggle,
    handleHashtagPresetChange,
    updateDisplayedHashtags,
    handlePreview,
  } = useLongFormEditState({ userTags, hashtagPresets });

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <LongFormEditHeader displayedHashtags={displayedHashtags} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraftPickerOpen(true)}
          >
            Open draft
          </Button>
          {typedPost ? (
            <DraftVersionHistory
              versions={versions}
              actionUrl={`/dashboard/drafts/longform/edit/${typedPost.id}`}
            />
          ) : null}
        </div>
      </div>
      <DraftPickerModal
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        type="longform"
        onSelect={(id) => navigate(`/dashboard/drafts/longform/edit/${id}`)}
      />

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
          userTags={userTags}
          assets={assets}
          onQueueTypeChange={(name) => void updateDisplayedHashtags(name)}
          onPreview={handlePreview}
          initialData={
            typedPost
              ? {
                  title: typedPost.title,
                  summary: typedPost.summary,
                  content: typedPost.content,
                  image: typedPost.image,
                  queueType: typedPost.queueType ?? undefined,
                }
              : null
          }
          isEditing={true}
          hashTagPresets={hashtagPresets}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onUseHashtagPresetsChange={handleHashtagPresetToggle}
          onHashtagPresetChange={(presetId) =>
            handleHashtagPresetChange(presetId ?? "")
          }
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
