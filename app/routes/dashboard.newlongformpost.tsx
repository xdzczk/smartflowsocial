import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useActionData,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import LongFormPost from "~/features/posts/components/LongFormPost";
import LongFormPreviewModal from "~/features/posts/components/LongFormPreviewModal";
import { NewLongFormHeader } from "~/features/posts/components/NewLongFormHeader";
import { ErrorMessage } from "~/features/posts/components/ErrorMessage";
import { useNewLongFormState } from "~/features/posts/hooks/useNewLongFormState";
import { loadNewLongFormData } from "~/features/posts/services/newlongform-loader.server";
import { handleNewLongFormAction } from "~/features/posts/services/newlongform-action.server";

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

export default function NewLongFormPost() {
  const {
    userId,
    tags: userTags,
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    assets,
    userTimezone,
    uploadProvider,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

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
  } = useNewLongFormState({ userTags });

  return (
    <div className="p-6">
      <NewLongFormHeader displayedHashtags={displayedHashtags} />

      <ErrorMessage error={actionData?.error} success={actionData?.success} />

      <Form method="post" encType="multipart/form-data">
        <LongFormPost
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={userTags}
          hashTagPresets={hashTagPresets}
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
