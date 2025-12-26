import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { DraftEditForm } from "~/features/posts/components/DraftEditForm";
import { DraftPreview } from "~/features/posts/components/DraftPreview";
import { ResumeModal } from "~/features/posts/components/ResumeModal";
import { useDraftEditState } from "~/features/posts/hooks/useDraftEditState";
import { handleDraftEditAction } from "~/features/posts/services/draft-edit-action.server";
import { loadDraftEditData } from "~/features/posts/services/draft-edit-loader.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const postId = params.id!;

  const data = await loadDraftEditData(userId, postId);
  return json(data);
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const postId = params.id!;
    const formData = await request.formData();
    const result = await handleDraftEditAction(formData, userId, postId);
    
    if (result.error) {
      return json(result, { status: 400 });
    }
    
    if (result.redirect) {
      return redirect(result.redirect);
    }
    
    return json(result);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function EditDraft() {
  const { post, user, queueTypes, hashTagPresets } = useLoaderData<typeof loader>();

  const {
    content,
    selectedQueue,
    scheduledFor,
    showResumeModal,
    useHashtagPresets,
    selectedHashtagPresetId,
    isSubmitting,
    fetcher,
    setContent,
    setSelectedQueue,
    setScheduledFor,
    setShowResumeModal,
    setUseHashtagPresets,
    handleResumeClick,
    handleSignAndResume,
    handleHashtagPresetSelect,
  } = useDraftEditState({ post, user, hashTagPresets });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
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
          post={post}
          selectedQueue={selectedQueue}
          queueTypes={queueTypes}
        />

        <DraftEditForm
          post={post}
          content={content}
          caption={post.caption || ""}
          selectedQueue={selectedQueue}
          scheduledFor={scheduledFor}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          queueTypes={queueTypes}
          hashTagPresets={hashTagPresets}
          isSubmitting={isSubmitting}
          onContentChange={setContent}
          onQueueChange={setSelectedQueue}
          onScheduledForChange={setScheduledFor}
          onHashtagPresetSelect={handleHashtagPresetSelect}
          onUseHashtagPresetsChange={setUseHashtagPresets}
          onResumeClick={handleResumeClick}
        />
      </div>

      <ResumeModal
        isOpen={showResumeModal}
        selectedQueue={selectedQueue}
        scheduledFor={scheduledFor}
        content={content}
        caption={post.caption || ""}
        isSubmitting={isSubmitting}
        onClose={() => setShowResumeModal(false)}
        onConfirm={handleSignAndResume}
      />
    </div>
  );
}
