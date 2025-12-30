import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import {
  DraftEditForm,
  DraftPreview,
  ResumeModal,
  useDraftEditState,
  handleDraftEditAction,
  loadDraftEditData,
  convertJsonValueToScheduleConfig,
  type PostData,
  type UserData,
  type QueueType,
  type HashTagPreset,
} from "~/features/posts";
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
  const loaderData = useLoaderData<typeof loader>();
  // Type assertions for Remix JsonifyObject serialization
  const postRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "post" in loaderData ? loaderData.post : null;
  const userRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "user" in loaderData ? loaderData.user : null;
  const queueTypesRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "queueTypes" in loaderData && Array.isArray(loaderData.queueTypes) ? loaderData.queueTypes : [];
  const hashTagPresetsRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "hashTagPresets" in loaderData && Array.isArray(loaderData.hashTagPresets) ? loaderData.hashTagPresets : [];

  // Type assertions for Remix JsonifyObject serialization
  const typedPost = postRaw && typeof postRaw === "object" && postRaw !== null ? postRaw as unknown as PostData : null;
  const typedUser = userRaw && typeof userRaw === "object" && userRaw !== null ? userRaw as unknown as UserData : null;
  const typedQueueTypes: QueueType[] = queueTypesRaw
    .filter((qt: unknown): qt is { id: string; name: string; scheduleConfig?: unknown; [key: string]: unknown } => 
      typeof qt === "object" && qt !== null && "id" in qt && "name" in qt &&
      typeof (qt as { id: unknown; name: unknown }).id === "string" &&
      typeof (qt as { id: unknown; name: unknown }).name === "string"
    )
    .map((qt) => ({
      id: qt.id,
      name: qt.name,
      color: typeof qt.color === "string" ? qt.color : undefined,
      description: typeof qt.description === "string" ? qt.description : undefined,
      scheduleType: (typeof qt.scheduleType === "string" && (qt.scheduleType === "INTERVAL" || qt.scheduleType === "FIXED_SLOTS")) ? qt.scheduleType : undefined,
      scheduleConfig: convertJsonValueToScheduleConfig(qt.scheduleConfig),
      isEnabled: typeof qt.isEnabled === "boolean" ? qt.isEnabled : undefined,
      userId: typeof qt.userId === "string" ? qt.userId : undefined,
    }));
  const typedHashTagPresets: HashTagPreset[] = hashTagPresetsRaw
    .filter((preset: unknown): preset is { id: string; name: string; tags: string; description?: string | null; createdAt?: unknown; updatedAt?: unknown; userId?: unknown } => 
      typeof preset === "object" && preset !== null && "id" in preset && "name" in preset && "tags" in preset &&
      typeof (preset as { id: unknown; name: unknown; tags: unknown }).id === "string" &&
      typeof (preset as { id: unknown; name: unknown; tags: unknown }).name === "string" &&
      typeof (preset as { id: unknown; name: unknown; tags: unknown }).tags === "string"
    )
    .map((preset) => ({
      id: preset.id,
      name: preset.name,
      tags: preset.tags,
      description: preset.description ?? undefined,
      userId: typeof preset.userId === "string" ? preset.userId : undefined,
      createdAt: typeof preset.createdAt === "string" ? new Date(preset.createdAt) : undefined,
      updatedAt: typeof preset.updatedAt === "string" ? new Date(preset.updatedAt) : undefined,
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
    post: typedPost ? {
      content: typedPost.content ?? null,
      caption: typedPost.caption ?? null,
      queueType: typedPost.queueType ? { name: typedPost.queueType.name } : null,
      hashTagPresetId: typedPost.hashTagPresetId ?? null,
      fileUrl: typedPost.fileUrl ?? null,
    } : {
      content: null,
      caption: null,
      queueType: null,
      hashTagPresetId: null,
      fileUrl: null,
    }, 
    user: typedUser ?? {
      id: "",
    }, 
    hashTagPresets: typedHashTagPresets 
  });

  if (!typedPost || !typedUser) {
    return <div>Loading...</div>;
  }

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
          post={typedPost}
          selectedQueue={selectedQueue}
          queueTypes={typedQueueTypes}
        />

        <DraftEditForm
          post={typedPost}
          content={content}
          caption={typedPost.caption ?? ""}
          selectedQueue={selectedQueue}
          scheduledFor={scheduledFor}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          queueTypes={typedQueueTypes}
          hashTagPresets={typedHashTagPresets}
          isSubmitting={isSubmitting}
          onContentChange={setContent}
          onQueueChange={setSelectedQueue}
          onScheduledForChange={setScheduledFor}
          onHashtagPresetSelect={(presetId, _hashtags) => handleHashtagPresetSelect(presetId ?? "", _hashtags ?? "")}
          onUseHashtagPresetsChange={setUseHashtagPresets}
          onResumeClick={handleResumeClick}
        />
      </div>

      <ResumeModal
        isOpen={showResumeModal}
        selectedQueue={selectedQueue}
        scheduledFor={scheduledFor}
        content={content}
        caption={typedPost.caption || ""}
        isSubmitting={isSubmitting}
        onClose={() => setShowResumeModal(false)}
        onConfirm={() => void handleSignAndResume()}
      />
    </div>
  );
}
