import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useActionData,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import LongFormPost from "~/features/posts/components/LongFormPost";
import LongFormPreviewModal from "~/features/posts/components/LongFormPreviewModal";
import { LongFormEditHeader } from "~/features/posts/components/LongFormEditHeader";
import { ErrorMessage } from "~/features/posts/components/ErrorMessage";
import { useLongFormEditState } from "~/features/posts/hooks/useLongFormEditState";
import { loadLongFormEditData } from "~/features/posts/services/longform-edit-loader.server";
import { handleLongFormEditAction } from "~/features/posts/services/longform-edit-action.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const postId = params.id;

  if (!postId) {
    throw new Response("Post not found", { status: 404 });
  }

  const data = await loadLongFormEditData(userId, postId);
  return json(data);
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const postId = params.id;

    if (!postId) {
      throw new Response("Post not found", { status: 404 });
    }

    return await handleLongFormEditAction(userId, postId, request);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function EditLongFormPost() {
  const {
    post,
    userId,
    tags: userTags,
    scheduleIntervals,
    queueTypes,
    assets,
    userTimezone,
    hashtagPresets,
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
    handleHashtagPresetToggle,
    handleHashtagPresetChange,
    updateDisplayedHashtags,
    handlePreview,
  } = useLongFormEditState({ userTags, hashtagPresets });

  return (
    <div className="p-6">
      <LongFormEditHeader displayedHashtags={displayedHashtags} />

      <ErrorMessage error={actionData?.error} success={actionData?.success} />

      <Form method="post" encType="multipart/form-data">
        <LongFormPost
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={userTags}
          assets={assets}
          onQueueTypeChange={updateDisplayedHashtags}
          onPreview={handlePreview}
          initialData={post}
          isEditing={true}
          hashTagPresets={hashtagPresets}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onUseHashtagPresetsChange={handleHashtagPresetToggle}
          onHashtagPresetChange={handleHashtagPresetChange}
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
