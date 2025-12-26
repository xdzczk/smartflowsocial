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
  const { queueTypes, hashTagPresets, assets } = useLoaderData<typeof loader>();

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
            queueTypes={queueTypes}
            assets={assets}
            hashTagPresets={hashTagPresets}
            selectedQueueType={selectedQueueType}
            onQueueTypeChange={handleQueueTypeChange}
            selectedHashTagPresetId={selectedHashTagPresetId}
            onHashtagPresetChange={handleHashtagPresetSelect}
          />
        </TabsContent>
        <TabsContent value="media">
          {showImagePreview ? (
            <NewPostImagesConfirmation
              preparedEvents={[preparedImageEvent]}
              files={files}
              onCancel={() => setShowImagePreview(false)}
              postsCount={1}
              selectedHashTagPresetId={selectedHashTagPresetId}
            />
          ) : (
            <MediaPost
              files={files}
              setFiles={setFiles}
              setShowImagePreview={setShowImagePreview}
              setPreparedImageEvent={setPreparedImageEvent}
              queueTypes={queueTypes}
              hashTagPresets={hashTagPresets}
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
