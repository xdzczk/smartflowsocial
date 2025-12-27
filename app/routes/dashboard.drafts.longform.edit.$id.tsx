import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useActionData,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { ErrorMessage } from "~/features/posts/components/ErrorMessage";
import { LongFormEditHeader } from "~/features/posts/components/LongFormEditHeader";
import LongFormPost from "~/features/posts/components/LongFormPost";
import LongFormPreviewModal from "~/features/posts/components/LongFormPreviewModal";
import { useLongFormEditState } from "~/features/posts/hooks/useLongFormEditState";
import { handleLongFormEditAction } from "~/features/posts/services/longform-edit-action.server";
import { loadLongFormEditData } from "~/features/posts/services/longform-edit-loader.server";

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

type LoaderData = Awaited<ReturnType<typeof loader>>;
type ActionData = Awaited<ReturnType<typeof action>>;

export default function EditLongFormPost() {
  const loaderData = useLoaderData<LoaderData>();
  const {
    post,
    userId,
    tags: userTags,
    scheduleIntervals: scheduleIntervalsRaw,
    queueTypes,
    assets: assetsRaw,
    userTimezone,
    hashtagPresets,
  } = loaderData;
  const actionData = useActionData<ActionData>();

  // Type assertions for Remix JsonifyObject serialization
  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw) 
    ? scheduleIntervalsRaw.map(s => typeof s === "string" ? parseInt(s, 10) : s).filter((n): n is number => !isNaN(n))
    : [];
  const assets = Array.isArray(assetsRaw) ? assetsRaw as unknown as { id: string; fileUrl?: string; title?: string; content?: string; assetType: string }[] : [];
  const typedPost = post && typeof post === "object" ? post as unknown as { id: string; title?: string; summary?: string; content?: string; image?: string; queueType?: { name: string } | null } : null;

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
          queueTypes={Array.isArray(queueTypes) ? queueTypes as unknown as { id: string; name: string; color?: string | null; scheduleType?: string; scheduleConfig?: unknown; isEnabled?: boolean }[] : []}
          scheduleIntervals={scheduleIntervals}
          userTags={userTags}
          assets={assets}
          onQueueTypeChange={updateDisplayedHashtags}
          onPreview={handlePreview}
          initialData={typedPost}
          isEditing={true}
          hashTagPresets={Array.isArray(hashtagPresets) ? hashtagPresets as unknown as { id: string; name: string; tags: string; description?: string | null }[] : []}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onUseHashtagPresetsChange={handleHashtagPresetToggle}
          onHashtagPresetChange={(presetId) => handleHashtagPresetChange(presetId || "")}
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
