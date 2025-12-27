import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireUserId } from "~/features/auth/session.server";
import MediaPost from "~/features/posts/components/MediaPost";
import { NewPostHeader } from "~/features/posts/components/NewPostHeader";
import NewPostImagesConfirmation from "~/features/posts/components/NewPostImagesConfirmation";
import TextPost from "~/features/posts/components/TextPost";
import { useNewPostState } from "~/features/posts/hooks/useNewPostState";
import { handleNewPostAction } from "~/features/posts/services/newpost-action.server";
import { loadNewPostData } from "~/features/posts/services/newpost-loader.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const data = await loadNewPostData(userId);
  return json(data);
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    return await handleNewPostAction(userId, request);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function NewPost() {
  const loaderData = useLoaderData<typeof loader>();
  const { queueTypes, hashTagPresets, assets } = loaderData;

  // Type assertions for Remix JsonifyObject serialization
  const typedQueueTypes = Array.isArray(queueTypes) ? queueTypes as unknown as { id: string; name: string; color?: string | null; scheduleType?: string; scheduleConfig?: unknown; isEnabled?: boolean }[] : [];
  const typedHashTagPresets = Array.isArray(hashTagPresets) ? hashTagPresets as unknown as { id: string; name: string; tags: string; description?: string | null }[] : [];
  const typedAssets = Array.isArray(assets) ? assets as unknown as { id: string; fileUrl?: string; title?: string; content?: string; assetType: string }[] : [];

  const {
    files,
    setFiles,
    selectedQueueType,
    selectedHashTagPresetId,
    selectedHashtags,
    showImagePreview,
    setShowImagePreview,
    preparedImageEvent,
    setPreparedImageEvent,
    handleQueueTypeChange,
    handleHashtagPresetSelect,
  } = useNewPostState();

  return (
    <div className="p-6">
      <NewPostHeader selectedHashtags={selectedHashtags} />

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text">Text Post</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>
        <TabsContent value="text">
          <TextPost
            queueTypes={typedQueueTypes}
            assets={typedAssets}
            hashTagPresets={typedHashTagPresets}
            onQueueTypeChange={handleQueueTypeChange}
            selectedHashTagPresetId={selectedHashTagPresetId}
            onHashtagPresetChange={(presetId, hashtags) => handleHashtagPresetSelect(presetId || "", hashtags)}
          />
        </TabsContent>
        <TabsContent value="media">
          {showImagePreview ? (
            <NewPostImagesConfirmation
              preparedEvents={preparedImageEvent ? [preparedImageEvent as unknown as { content: { fileUrl: string; scheduledFor: string; caption: string; queueType: string }; type: "media"; queueType: string }] : []}
              onCancel={() => setShowImagePreview(false)}
              postsCount={1}
              tags={selectedHashTagPresetId || ""}
            />
          ) : (
            <MediaPost
              files={files}
              setFiles={setFiles}
              setShowImagePreview={setShowImagePreview}
              setPreparedImageEvent={(data) => setPreparedImageEvent(data && data.length > 0 ? (data[0] as unknown as { content: { fileUrl: string; scheduledFor: string; caption: string; queueType: string }; type: "media"; queueType: string } | null) : null)}
              queueTypes={typedQueueTypes}
              hashTagPresets={typedHashTagPresets}
              selectedQueueType={selectedQueueType}
              onQueueTypeChange={handleQueueTypeChange}
              selectedHashTagPresetId={selectedHashTagPresetId}
              onHashtagPresetChange={handleHashtagPresetSelect}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
