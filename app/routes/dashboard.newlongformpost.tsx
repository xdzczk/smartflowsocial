import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useActionData,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { ErrorMessage } from "~/features/posts/components/ErrorMessage";
import LongFormPost from "~/features/posts/components/LongFormPost";
import LongFormPreviewModal from "~/features/posts/components/LongFormPreviewModal";
import { NewLongFormHeader } from "~/features/posts/components/NewLongFormHeader";
import { useNewLongFormState } from "~/features/posts/hooks/useNewLongFormState";
import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";
import { loadNewLongFormData } from "~/features/posts/services/newlongform-loader.server";

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

type LoaderData = Awaited<ReturnType<typeof loader>>;
type ActionData = Awaited<ReturnType<typeof action>>;

export default function NewLongFormPost() {
  const loaderData = useLoaderData<LoaderData>();
  const {
    userId,
    tags: userTags,
    scheduleIntervals: scheduleIntervalsRaw,
    queueTypes,
    hashTagPresets,
    assets: assetsRaw,
    userTimezone,
    uploadProvider,
  } = loaderData;
  const actionData = useActionData<ActionData>();

  // Type assertions for Remix JsonifyObject serialization
  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw) 
    ? scheduleIntervalsRaw.map((s: unknown) => {
        if (typeof s === "string") {
          const parsed = parseInt(s, 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (typeof s === "number") {
          return s;
        }
        return null;
      }).filter((n): n is number => n !== null)
    : [];
  const assets = Array.isArray(assetsRaw) ? assetsRaw as unknown as { id: string; fileUrl?: string; title?: string; content?: string; assetType: string }[] : [];

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

      <ErrorMessage error={actionData?.error} success={actionData?.success} />

      <Form method="post" encType="multipart/form-data">
        <LongFormPost
          queueTypes={Array.isArray(queueTypes) ? queueTypes as unknown as { id: string; name: string; color?: string | null; scheduleType?: string; scheduleConfig?: unknown; isEnabled?: boolean }[] : []}
          scheduleIntervals={scheduleIntervals}
          userTags={safeUserTags}
          hashTagPresets={Array.isArray(hashTagPresets) ? hashTagPresets as unknown as { id: string; name: string; tags: string; description?: string | null }[] : []}
          assets={assets}
          uploadProvider={uploadProvider}
          userTimezone={userTimezone}
          onQueueTypeChange={updateDisplayedHashtags}
          onPreview={handlePreview}
          useHashtagPresets={useHashtagPresets}
          onUseHashtagPresetsChange={handleUseHashtagPresetsChange}
          selectedHashtagPresetId={selectedHashtagPresetId}
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
