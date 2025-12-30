import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";

import { type ToastMessage } from "~/components/types";
import MediaModal from "~/components/ui/MediaModal";
import Toast from "~/components/ui/Toast";
import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import {
  BulkPostsActionButtons,
  BulkPostsTable,
  BulkPostsUploadArea,
  PostConfirmation,
  getBulkPostsDashboardData,
} from "~/features/posts";
import {
  handleFileChange as handleFileChangeHandler,
  handleCaptionChange as handleCaptionChangeHandler,
  handleDateChange as handleDateChangeHandler,
  handleIsRecyclableChange as handleIsRecyclableChangeHandler,
  handleBulkRecyclableToggle as handleBulkRecyclableToggleHandler,
  handleRemovePost as handleRemovePostHandler,
  handleScheduleIntervalClick as handleScheduleIntervalClickHandler,
  handleQueueTypeChange as handleQueueTypeChangeHandler,
  handleBulkQueueUpdate as handleBulkQueueUpdateHandler,
} from "~/features/posts/bulkposts.handlers";
import { type BulkPost, type QueueType , type PreparedEvent } from "~/features/posts/types";
import { useBulkPostEvents } from "~/features/posts/useBulkPostEvents";
import { useBulkPostsState } from "~/features/posts/useBulkPostsState";
import { useOptionalUser } from "~/lib/remix-utils";
import { isVideoFile } from "~/utils/media-helpers";

export { bulkPostsAction as action } from "~/features/posts/bulkposts.action.server";


export async function loader({ request }: { request: Request }) {
  try {
    const userId = await requireUserId(request);

    // Check if user has access to bulk scheduling feature
    await requireFeatureAccess(userId, 'bulkScheduling');
    const data = await getBulkPostsDashboardData(userId);

    return json(data);
  } catch (error) {
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      tags: [],
      queueTypes: [],
      hashTagPresets: [],
      mode: null,
    });
  }
}



export default function BulkPosts() {
  const data = useLoaderData<{
    tags: string[];
    queueTypes: QueueType[];
    hashTagPresets: { id: string; name: string; hashtags: string }[];
    mode: string | null;
  }>();
  const tags = "tags" in data && Array.isArray(data.tags) ? data.tags : [];
  const queueTypes = "queueTypes" in data && Array.isArray(data.queueTypes) ? data.queueTypes : [];
  const hashTagPresets = "hashTagPresets" in data && Array.isArray(data.hashTagPresets) ? data.hashTagPresets : [];
  const mode = "mode" in data ? data.mode : null;
  const [posts, setPosts] = useState<BulkPost[]>([]);
  const [displayedHashtags, setDisplayedHashtags] = useState<string | string[]>(tags);
  const [_selectedQueueType, setSelectedQueueType] = useState("unassigned");
  const fetcher = useFetcher<{ success?: boolean; fileUrls?: { fileUrl: string; scheduledFor: string; queueType: string }[] }>();
  const isSubmitting = fetcher.state !== "idle";
  const userOptional = useOptionalUser();
  const user = userOptional ?? null;
  const scheduleIntervals = user?.scheduleInterval 
    ? (Array.isArray(user.scheduleInterval) 
        ? user.scheduleInterval.map(s => typeof s === "string" ? parseInt(s, 10) : s).filter((n): n is number => !isNaN(n)) 
        : []) 
    : undefined;

  const [preparedEvents, setPreparedEvents] = useState<PreparedEvent[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
  });
  const [firstItemTimeManuallyChanged, setFirstItemTimeManuallyChanged] =
    useState(false);
  const [isPreviewSubmitting, setIsPreviewSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [uploadProvider, setUploadProvider] = useState<string | null>(null);
  const [useHashtagPresets, setUseHashtagPresets] = useState(false);
  const [selectedHashtagPresetId, setSelectedHashtagPresetId] = useState<
    string | null
  >(null);
  const [selectedHashtags, setSelectedHashtags] = useState("");

  // Use extracted hooks
  useBulkPostsState({ mode, posts, setPosts });
  const { prepareEvents } = useBulkPostEvents({
    posts,
    fetcher,
    user,
    tags,
    useHashtagPresets,
    selectedHashtags,
    setToast,
    setPreparedEvents,
    setShowConfirmation,
    setIsPreviewSubmitting,
    setIsProcessing
  });

  // Fetch upload provider on component mount
  useEffect(() => {
    void fetch("/api/user-upload-provider")
      .then((res) => res.json())
      .then((data: unknown) => {
        const provider = data && typeof data === "object" && !Array.isArray(data) && "provider" in data && typeof (data as { provider?: unknown }).provider === "string" ? (data as { provider: string }).provider : null;
        setUploadProvider(provider);
      })
      .catch((err: unknown) => {
         
        const { handleErrorSafely } = require("~/lib/error-handler.client") as { handleErrorSafely: (error: unknown, context: { component: string; action: string }) => void };
        handleErrorSafely(err, {
          component: "BulkPosts",
          action: "fetchUploadProvider",
        });
      });
  }, []);


  // Wrapper functions that delegate to extracted handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const userDeps = user ? { id: user.id, timezone: user.timezone ?? undefined, scheduleInterval: scheduleIntervals } : null;
    void handleFileChangeHandler(e, {
      posts,
      setPosts,
      user: userDeps,
      scheduleIntervals,
      setIsProcessing,
      setProcessingProgress,
      setFirstItemTimeManuallyChanged,
    });
  };

  const handleCaptionChange = (index: number, value: string) => {
    handleCaptionChangeHandler(index, value, posts, setPosts);
  };

  const handleDateChange = (index: number, value: string) => {
    handleDateChangeHandler(index, value, posts, setPosts, setFirstItemTimeManuallyChanged);
  };

  const handleIsRecyclableChange = (index: number, checked: boolean) => {
    handleIsRecyclableChangeHandler(index, checked, posts, setPosts);
  };

  const handleMediaClick = (mediaSrc: string) => {
    setSelectedMedia(mediaSrc);
    setIsMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setSelectedMedia(null);
  };

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string,
  ) => {
    setSelectedHashtagPresetId(presetId);
    setSelectedHashtags(hashtags);
  };

  const handleBulkRecyclableToggle = () => {
    handleBulkRecyclableToggleHandler(posts, setPosts);
  };

  const handleQueueTypeChange = async (index: number, value: string) => {
    const userDeps = user ? { id: user.id, timezone: user.timezone ?? undefined, scheduleInterval: scheduleIntervals } : null;
    await handleQueueTypeChangeHandler(index, value, {
      posts,
      setPosts,
      queueTypes,
      tags,
      user: userDeps,
      setDisplayedHashtags,
      setSelectedQueueType,
    });
  };

  const handleRemovePost = (index: number) => {
    handleRemovePostHandler(index, posts, setPosts);
  };

  const handleScheduleIntervalClick = (interval: number) => {
    handleScheduleIntervalClickHandler(interval, posts, setPosts, firstItemTimeManuallyChanged);
  };

  const handleBulkQueueUpdate = async (queueType: string) => {
    const userDeps = user ? { id: user.id, timezone: user.timezone ?? undefined, scheduleInterval: scheduleIntervals } : null;
    await handleBulkQueueUpdateHandler(queueType, {
      posts,
      setPosts,
      queueTypes,
      tags,
      user: userDeps,
      setDisplayedHashtags,
      setSelectedQueueType,
      firstItemTimeManuallyChanged,
    });
  };

  // Posts changes now silent for production
  useEffect(() => {
    // State tracking disabled for production
  }, [posts]);

  // Memoize preview URLs and file types to prevent recreation on every render
  const previewData = useMemo(() => {
    const data = new Map<number, { url: string; isVideo: boolean; file: File }>();
    posts.forEach((post, index) => {
      if (post.file) {
        const url = URL.createObjectURL(post.file);
        const isVideo = isVideoFile(post.file);
        data.set(index, { url, isVideo, file: post.file });
      }
    });
    return data;
  }, [posts]);

  // Cleanup URLs when component unmounts or posts change
  useEffect(() => {
    return () => {
      previewData.forEach((data) => {
        if (data && typeof data === "object" && data !== null && "url" in data) {
          const url = data.url;
          if (typeof url === "string") {
            URL.revokeObjectURL(url);
          }
        }
      });
    };
  }, [previewData]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">
        {mode === "recycle"
          ? "Recycle & Schedule Posts"
          : mode === "repost"
            ? "Schedule Reposts (Kind 6)"
            : mode === "quote"
              ? "Schedule Quote Posts"
              : "Bulk Schedule Posts"}
      </h1>
      {displayedHashtags && displayedHashtags.length <= 10 ? (
        <div className="mb-6 inline-flex items-center gap-1 rounded bg-orange-200 px-2 py-1 text-xs font-semibold leading-4 text-orange-700">
          <svg
            className="hi-solid hi-hashtag inline-block size-4 opacity-75"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z"
              clipRule="evenodd"
            />
          </svg>
          <span>{displayedHashtags}</span>
        </div>
      ) : null}

      {!showConfirmation ? (
        <fetcher.Form
          onSubmit={(e) => { void prepareEvents(e); }}
          className="w-full"
          encType="multipart/form-data"
        >
          {mode !== "repost" && mode !== "quote" ? (
            <BulkPostsUploadArea
              isProcessing={isProcessing}
              processingProgress={processingProgress}
              onFileChange={handleFileChange}
              uploadProvider={uploadProvider}
            />
          ) : null}

          <BulkPostsActionButtons
            posts={posts}
            isProcessing={isProcessing}
            scheduleIntervals={scheduleIntervals}
            queueTypes={queueTypes}
            hashTagPresets={hashTagPresets}
            selectedHashtagPresetId={selectedHashtagPresetId}
            useHashtagPresets={useHashtagPresets}
            handleScheduleIntervalClick={handleScheduleIntervalClick}
            handleBulkQueueUpdate={(queueType) => void handleBulkQueueUpdate(queueType)}
            handleHashtagPresetSelect={handleHashtagPresetSelect}
            setUseHashtagPresets={setUseHashtagPresets}
            handleBulkRecyclableToggle={handleBulkRecyclableToggle}
          />

          {posts.length > 0 ? (
            <>
              <BulkPostsTable
                posts={posts}
                queueTypes={queueTypes}
                previewData={previewData}
                handleCaptionChange={handleCaptionChange}
                handleDateChange={handleDateChange}
                handleIsRecyclableChange={handleIsRecyclableChange}
                handleRemovePost={handleRemovePost}
                handleQueueTypeChange={(index, value) => void handleQueueTypeChange(index, value)}
                handleMediaClick={handleMediaClick}
              />

              <button
                type="submit"
                disabled={isSubmitting || isProcessing || isPreviewSubmitting}
                className="mt-6 w-full rounded-lg bg-blue-500 p-4 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isPreviewSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Validating & Preparing...
                  </span>
                ) : isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Uploading Media Files...
                  </span>
                ) : isProcessing ? (
                  "Processing Media Files..."
                ) : (
                  `Preview ${posts.length} Post${posts.length !== 1 ? "s" : ""}`
                )}
              </button>
            </>
          ) : null}
        </fetcher.Form>
      ) : (
        <PostConfirmation
          preparedEvents={preparedEvents ?? []}
          postsCount={posts.length}
        />
      )}

      {/* Toast Notification */}
      {toast ? (
        <Toast toast={toast} onClose={() => setToast(null)} />
      ) : null}

      {/* Media Modal */}
      {selectedMedia ? (
        <MediaModal
          src={selectedMedia}
          alt="Media content"
          isOpen={isMediaModalOpen}
          onClose={handleCloseMediaModal}
        />
      ) : null}
    </div>
  );
}
