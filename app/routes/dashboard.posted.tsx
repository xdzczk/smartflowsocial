import { Link, useParams } from "@remix-run/react";

const PROCESSING_TEXT = "Processing...";

import Toast from "~/components/ui/Toast";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import {
  getPostedDashboardData,
  type PostData,
  type LongFormPostData,
  type CombinedContent,
  type PostFetcher,
  type LongFormPostType as _LongFormPostType,
} from "~/features/posts/server";
import type { PostStats as _PostStats } from "~/features/posts/stats.server";
import {
  AllContentListing,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  PostedPostsTable,
  PostedPostsTabs,
  usePostedPosts,
  usePostedPostsData,
  useBulkDeletePostsMutation,
} from "~/features/posts/ui";
import type { User } from "~/features/user";
import {
  extractPostData,
  extractLongFormPostData,
} from "~/lib/validation/combined-content";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { comparePostDataByProperty } from "~/lib/validation/post-data-properties";
import { getPostStats, getPostStatsValue } from "~/lib/validation/post-stats";
import { postedPostsLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
// Re-export action from server module
export { postedPostsAction as action } from "~/features/posts/posted.action.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { queueType?: string };
}) {
  try {
    const userId = await requireUserId(request);
    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);

    const url = new URL(request.url);

    const data = await getPostedDashboardData({ userId, params, url });

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, postedPostsLoaderDataSchema);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

type _LoaderData = Awaited<ReturnType<typeof loader>>;

export default function PostedPosts() {
  // Use TanStack Query for data fetching with caching
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    pagination,
    stats,
    isLoading: _isLoading,
  } = usePostedPostsData();

  const params = useParams();

  // Use TanStack Query mutation for bulk delete with optimistic updates
  const bulkDeleteMutation = useBulkDeletePostsMutation();

  // Call hook unconditionally - hooks must be called at the top level
  const {
    currentTab,
    sortConfig,
    searchTerm,
    setSearchTerm,
    selectedPost,
    setSelectedPost,
    selectedPosts,
    selectedLongFormPost,
    setSelectedLongFormPost,
    toast,
    setToast,
    deleteFetcher,
    bulkDeleteFetcher,
    repostFetcher,
    individualRepostFetcher,
    longformRepostFetcher,
    longformQuoteFetcher,
    requestSort,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete: originalHandleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
  } = usePostedPosts({
    user: user as unknown as User,
    allContent,
    posts,
  });

  // Handle nullable user - if user is null, we should not render the component
  // This is a legitimate error state that should be handled properly
  if (!user) {
    return (
      <div className="p-4 text-center text-red-600">
        Error: User data not available. Please refresh the page.
      </div>
    );
  }

  // Enhanced bulk delete with optimistic updates
  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const postIds = Array.from(selectedPosts);

    // Use TanStack Query mutation for optimistic updates
    bulkDeleteMutation.mutate(postIds, {
      onSuccess: () => {
        // Clear selection on success
        // The optimistic update already removed items from UI
      },
      onError: () => {
        // Error handling - optimistic update will be rolled back automatically
        // Fall back to original handler if needed
        originalHandleBulkDelete();
      },
    });
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "postedAt") {
      const dateA = (
        a.postedAt instanceof Date
          ? a.postedAt
          : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: handle serialized Date strings
            a.postedAt
            ? new Date(a.postedAt)
            : new Date(0)
      ).getTime();
      const dateB = (
        b.postedAt instanceof Date
          ? b.postedAt
          : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: handle serialized Date strings
            b.postedAt
            ? new Date(b.postedAt)
            : new Date(0)
      ).getTime();
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }

    // Handle engagement metrics sorting
    if (
      [
        "likes",
        "replies",
        "mentions",
        "reposts",
        "zaps",
        "satszapped",
      ].includes(sortConfig.key)
    ) {
      const aEventId =
        a.signedEvent &&
        typeof a.signedEvent === "object" &&
        "id" in a.signedEvent &&
        typeof a.signedEvent.id === "string"
          ? a.signedEvent.id
          : "";
      const bEventId =
        b.signedEvent &&
        typeof b.signedEvent === "object" &&
        "id" in b.signedEvent &&
        typeof b.signedEvent.id === "string"
          ? b.signedEvent.id
          : "";

      // Use type-safe PostStats accessors
      const aStats = getPostStats(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: type narrowing for serialized data
        stats && typeof stats === "object" && !Array.isArray(stats)
          ? (stats as Record<string, unknown>)
          : undefined,
        aEventId
      );
      const bStats = getPostStats(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: type narrowing for serialized data
        stats && typeof stats === "object" && !Array.isArray(stats)
          ? (stats as Record<string, unknown>)
          : undefined,
        bEventId
      );
      const sortKey = sortConfig.key;
      const aValue = getPostStatsValue(aStats, sortKey);
      const bValue = getPostStatsValue(bStats, sortKey);
      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    // Use type-safe property accessor for PostData
    return comparePostDataByProperty(
      a,
      b,
      sortConfig.key,
      sortConfig.direction as "asc" | "desc"
    );
  });

  const filteredPosts = sortedPosts.filter((post) =>
    post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Posted History</h3>
        </div>
      </div>

      <PostedPostsTabs
        currentTab={currentTab}
        queueTypes={queueTypes.map((qt) => ({
          name: qt.name,
          color: qt.color ?? undefined,
        }))}
        allContentLength={allContent.length}
        postsLength={filteredPosts.length}
        longformPostsLength={longformPosts.length}
      />

      {/* Content based on current tab */}
      {currentTab === "all" ? (
        <AllContentListing
          content={allContent}
          type="posted"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user.timezone ?? undefined}
          onPostSelect={(content) => {
            // Handle selection based on content type using type guards
            if (content.type === "post") {
              const postData = extractPostData(content);
              if (postData) {
                setSelectedPost(postData);
              }
            } else {
              const longFormData = extractLongFormPostData(content);
              if (longFormData) {
                setSelectedLongFormPost(longFormData);
              }
            }
          }}
          selectedItems={selectedPosts}
          onToggleSelection={togglePostSelection}
          onToggleSelectAll={() =>
            toggleSelectAll(filteredPosts as PostData[] | CombinedContent[])
          }
          showBulkActions={true}
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={
            bulkDeleteMutation.isPending
              ? "submitting"
              : bulkDeleteFetcher.state
          }
          // Advanced actions for posted content
          individualRepostFetcher={individualRepostFetcher}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          onBulkRepost={handleBulkRepost}
          onBulkScheduledRepost={handleBulkScheduledRepost}
          onBulkQuote={handleBulkQuote}
          repostFetcher={repostFetcher as PostFetcher}
        />
      ) : currentTab === "posts" ? (
        <div>
          {/* Search Bar for Posts */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l text-gray-500">
                <svg
                  className="hi-mini hi-magnifying-glass inline-block size-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                name="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 py-2 pr-3 pl-10 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                placeholder="Search posts.."
              />
            </div>
          </div>

          {selectedPosts.size > 0 ? (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {selectedPosts.size} post{selectedPosts.size !== 1 ? "s" : ""}{" "}
                selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkRepost}
                  disabled={repostFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {repostFetcher.state !== "idle"
                    ? PROCESSING_TEXT
                    : `Recycle ${selectedPosts.size} Post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleBulkScheduledRepost}
                  disabled={repostFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  {repostFetcher.state !== "idle"
                    ? PROCESSING_TEXT
                    : `Repost ${selectedPosts.size} Post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleBulkQuote}
                  disabled={repostFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  {repostFetcher.state !== "idle"
                    ? PROCESSING_TEXT
                    : `Quote ${selectedPosts.size} Post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={
                    bulkDeleteMutation.isPending ||
                    bulkDeleteFetcher.state !== "idle"
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
                >
                  {bulkDeleteMutation.isPending ||
                  bulkDeleteFetcher.state !== "idle"
                    ? "Deleting..."
                    : `Delete ${selectedPosts.size} post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          ) : null}

          <PostedPostsTable
            filteredPosts={filteredPosts}
            selectedPosts={selectedPosts}
            stats={stats}
            sortConfig={sortConfig}
            toggleSelectAll={() =>
              toggleSelectAll(filteredPosts as PostData[] | CombinedContent[])
            }
            togglePostSelection={togglePostSelection}
            requestSort={requestSort}
            setSelectedPost={setSelectedPost}
            individualRepostFetcher={individualRepostFetcher}
            deleteFetcher={deleteFetcher}
            bulkDeleteFetcher={bulkDeleteFetcher}
          />

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{" "}
              {Math.min(
                pagination.currentPage * pagination.limit,
                pagination.total
              )}{" "}
              of {pagination.total} posts
            </div>
            <div className="flex gap-2">
              <Link
                to={`${params["queueType"] ? `/dashboard/posted/${params["queueType"]}` : "/dashboard/posted"}?page=${pagination.currentPage - 1}`}
                className={`rounded-lg border px-3 py-1 ${
                  pagination.currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : "hover:bg-gray-100"
                }`}
              >
                Previous
              </Link>
              <Link
                to={`${params["queueType"] ? `/dashboard/posted/${params["queueType"]}` : "/dashboard/posted"}?page=${pagination.currentPage + 1}`}
                className={`rounded-lg border px-3 py-1 ${
                  pagination.currentPage === pagination.pages
                    ? "pointer-events-none opacity-50"
                    : "hover:bg-gray-100"
                }`}
              >
                Next
              </Link>
            </div>
          </div>

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              stats={
                /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
                typeof selectedPost === "object" &&
                selectedPost !== null &&
                "signedEvent" in selectedPost &&
                selectedPost.signedEvent &&
                typeof selectedPost.signedEvent === "object" &&
                "id" in selectedPost.signedEvent &&
                typeof selectedPost.signedEvent.id === "string"
                  ? stats[selectedPost.signedEvent.id]
                  : undefined
              }
              /* eslint-enable @typescript-eslint/no-unnecessary-condition */
              onClose={() => setSelectedPost(null)}
              showStats={true}
              showSignedEvent={true}
              type="posted"
              userTimezone={user.timezone ?? undefined}
            />
          ) : null}
        </div>
      ) : (
        /* Longform Posts Content */
        <LongFormListing
          posts={longformPosts}
          type="posted"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user.timezone ?? undefined}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as LongFormPostData);
          }}
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="posted"
          showSignedEvent={true}
          userTimezone={user.timezone ?? undefined}
        />
      ) : null}

      {/* Toast Notification */}
      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
