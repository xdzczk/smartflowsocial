import { useFetcher, useParams } from "@remix-run/react";

import type { CombinedContent, PostData } from "~/features/posts/server";
import {
  PostDetailsModal,
  RecyclablesBulkActions,
  RecyclablesPagination,
  RecyclablesQueueTabs,
  RecyclablesSearch,
  RecyclablesTable,
  RecyclablesToast,
  useRecyclablesData,
  useRecyclablesState,
  type IndividualRepostFetcherData,
} from "~/features/posts/ui";

interface RepostFetcherData {
  repostData?: unknown;
  scheduledRepostData?: unknown;
  quotePostData?: unknown;
}

export default function RecyclablesPage() {
  // Use TanStack Query for data fetching with caching
  const {
    posts: typedPosts,
    pagination: typedPagination,
    stats: typedStats,
    user,
    queueTypes,
  } = useRecyclablesData();
  const params = useParams();

  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher<RepostFetcherData>();
  const individualRepostFetcher = useFetcher<IndividualRepostFetcherData>();

  const {
    sortConfig,
    searchTerm,
    selectedPost,
    selectedPosts,
    toast,
    filteredPosts,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
    setToast,
  } = useRecyclablesState({
    posts: typedPosts,
    stats: typedStats,
    user: user ?? null,
    repostFetcher,
    bulkDeleteFetcher,
    bulkRepostFetcher: repostFetcher,
    individualRepostFetcher,
  });

  return (
    <div>
      <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Recyclable Posts</h3>
        </div>
        <div className="flex items-center gap-2">
          <RecyclablesSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
      </div>

      <RecyclablesQueueTabs
        queueTypes={queueTypes}
        currentQueueType={params["queueType"]}
      />

      <RecyclablesBulkActions
        selectedCount={selectedPosts.size}
        onBulkRepost={handleBulkRepost}
        onBulkScheduledRepost={handleBulkScheduledRepost}
        onBulkQuote={handleBulkQuote}
        onBulkDelete={handleBulkDelete}
        repostFetcher={repostFetcher}
        bulkDeleteFetcher={bulkDeleteFetcher}
      />

      <RecyclablesTable
        posts={filteredPosts.map(
          (
            post
          ): {
            id: string;
            caption?: string | null;
            postedAt: Date | null;
            fileUrl: string[];
            signedEvent: { id: string };
            queueType?: { name: string; color?: string | null } | null;
            status?: string;
          } => ({
            id: post.id,
            caption: post.caption ?? null,
            postedAt:
              post.postedAt instanceof Date
                ? post.postedAt
                : typeof post.postedAt === "string"
                  ? new Date(post.postedAt)
                  : null,
            fileUrl: Array.isArray(post.fileUrl)
              ? post.fileUrl
              : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: fileUrl may be a string from legacy data
                post.fileUrl
                ? [post.fileUrl]
                : [],
            signedEvent:
              post.signedEvent &&
              typeof post.signedEvent === "object" &&
              "id" in post.signedEvent
                ? { id: String(post.signedEvent.id) }
                : { id: "" },
            queueType: post.queueType
              ? {
                  name: post.queueType.name,
                  color: post.queueType.color ?? null,
                }
              : null,
            status: typeof post.status === "string" ? post.status : undefined,
          })
        )}
        stats={typedStats}
        sortConfig={sortConfig}
        selectedPosts={selectedPosts}
        onRequestSort={requestSort}
        onPostClick={(post) => {
          // Find the original PostData from typedPosts array
          const originalPostData = typedPosts.find((p) => p.id === post.id);
          if (originalPostData) {
            // Convert to the Post format expected by useRecyclablesState
            setSelectedPost({
              ...originalPostData,
              postedAt:
                originalPostData.postedAt instanceof Date
                  ? originalPostData.postedAt
                  : typeof originalPostData.postedAt === "string"
                    ? new Date(originalPostData.postedAt)
                    : null,
              fileUrl: Array.isArray(originalPostData.fileUrl)
                ? originalPostData.fileUrl
                : typeof originalPostData.fileUrl === "string"
                  ? [originalPostData.fileUrl]
                  : [],
              signedEvent:
                originalPostData.signedEvent &&
                typeof originalPostData.signedEvent === "object" &&
                "id" in originalPostData.signedEvent
                  ? { id: String(originalPostData.signedEvent.id) }
                  : { id: "" },
            });
          }
        }}
        onToggleSelect={togglePostSelection}
        onToggleSelectAll={toggleSelectAll}
        deleteFetcher={deleteFetcher}
        individualRepostFetcher={individualRepostFetcher}
        bulkDeleteFetcher={bulkDeleteFetcher}
      />

      <RecyclablesPagination pagination={typedPagination} />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as PostData | CombinedContent}
          stats={(() => {
            const eventId =
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: type narrowing for serialized data
              selectedPost &&
              typeof selectedPost === "object" &&
              "signedEvent" in selectedPost &&
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: signedEvent may not exist
              selectedPost.signedEvent &&
              typeof selectedPost.signedEvent === "object" &&
              "id" in selectedPost.signedEvent
                ? String((selectedPost.signedEvent as { id?: string }).id)
                : "";
            const statsEntry = typedStats[eventId];
            return statsEntry
              ? {
                  likes: statsEntry.likes ?? 0,
                  replies: statsEntry.replies ?? 0,
                  mentions: statsEntry.mentions ?? 0,
                  reposts: statsEntry.reposts ?? 0,
                  zaps: statsEntry.zaps ?? 0,
                  satszapped: statsEntry.satszapped ?? 0,
                }
              : undefined;
          })()}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      <RecyclablesToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
