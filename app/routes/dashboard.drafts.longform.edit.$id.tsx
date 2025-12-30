import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useActionData,
} from "@remix-run/react";

import type { Asset } from "~/features/assets/types";
import { requireUserId } from "~/features/auth/session.server";
import {
  ErrorMessage,
  LongFormEditHeader,
  LongFormPost,
  LongFormPreviewModal,
  useLongFormEditState,
  handleLongFormEditAction,
  loadLongFormEditData,
} from "~/features/posts";

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
  // Type assertions for Remix JsonifyObject serialization
  const post = loaderData && typeof loaderData === "object" && loaderData !== null && "post" in loaderData ? loaderData.post : null;
  const _userId = loaderData && typeof loaderData === "object" && loaderData !== null && "userId" in loaderData ? (typeof loaderData.userId === "string" ? loaderData.userId : String(loaderData.userId ?? "")) : "";
  const userTags = loaderData && typeof loaderData === "object" && loaderData !== null && "tags" in loaderData ? (typeof loaderData.tags === "string" ? loaderData.tags : String(loaderData.tags ?? "")) : "";
  const scheduleIntervalsRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "scheduleIntervals" in loaderData ? loaderData.scheduleIntervals : null;
  const queueTypesRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "queueTypes" in loaderData && Array.isArray(loaderData.queueTypes) ? loaderData.queueTypes : [];
  const assetsRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "assets" in loaderData && Array.isArray(loaderData.assets) ? (loaderData.assets as unknown[]) : [];
  const _userTimezone = loaderData && typeof loaderData === "object" && loaderData !== null && "userTimezone" in loaderData ? (typeof loaderData.userTimezone === "string" ? loaderData.userTimezone : String(loaderData.userTimezone ?? "Etc/GMT")) : "Etc/GMT";
  const hashtagPresetsRaw = loaderData && typeof loaderData === "object" && loaderData !== null && "hashtagPresets" in loaderData && Array.isArray(loaderData.hashtagPresets) ? loaderData.hashtagPresets : [];
  const actionData = useActionData<ActionData>();

  // Type assertions for Remix JsonifyObject serialization
  const scheduleIntervals = Array.isArray(scheduleIntervalsRaw) 
    ? scheduleIntervalsRaw.map((s: unknown) => typeof s === "string" ? parseInt(s, 10) : typeof s === "number" ? s : null).filter((n): n is number => n !== null && !isNaN(n))
    : [];
  const assets = assetsRaw.filter((asset: unknown): asset is Asset => 
    typeof asset === "object" && asset !== null && "id" in asset && typeof (asset as { id: unknown }).id === "string"
  );
  const typedPost = post && typeof post === "object" && post !== null && "id" in post && typeof (post as { id: unknown }).id === "string" ? post as { id: string; title?: string; summary?: string; content?: string; image?: string; queueType?: { name: string } | null } : null;
  const queueTypes = queueTypesRaw.filter((qt: unknown): qt is { id: string; name: string; color?: string | null; scheduleType?: string; scheduleConfig?: unknown; isEnabled?: boolean } => 
    typeof qt === "object" && qt !== null && "id" in qt && "name" in qt &&
    typeof (qt as { id: unknown; name: unknown }).id === "string" &&
    typeof (qt as { id: unknown; name: unknown }).name === "string"
  );
  const hashtagPresets = hashtagPresetsRaw.filter((preset: unknown): preset is { id: string; name: string; tags: string; description?: string | null } => 
    typeof preset === "object" && preset !== null && "id" in preset && "name" in preset && "tags" in preset &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).id === "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).name === "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).tags === "string"
  );

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

      <ErrorMessage error={actionData && typeof actionData === "object" && "error" in actionData ? actionData.error as string | undefined : undefined} success={actionData && typeof actionData === "object" && "success" in actionData ? (actionData.success as boolean | undefined) : undefined} />

      <Form method="post" encType="multipart/form-data">
        <LongFormPost
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={userTags}
          assets={assets}
          onQueueTypeChange={(name) => void updateDisplayedHashtags(name)}
          onPreview={handlePreview}
          initialData={typedPost ? { title: typedPost.title, summary: typedPost.summary, content: typedPost.content, image: typedPost.image, queueType: typedPost.queueType ?? undefined } as unknown as { title?: string; summary?: string; content?: string; image?: string; queueType?: { name: string } } : null}
          isEditing={true}
          hashTagPresets={hashtagPresets}
          useHashtagPresets={useHashtagPresets}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onUseHashtagPresetsChange={handleHashtagPresetToggle}
          onHashtagPresetChange={(presetId) => handleHashtagPresetChange(presetId ?? "")}
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
