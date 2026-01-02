import { Link, useLoaderData, useParams } from "@remix-run/react";

import Toast from "~/components/ui/Toast";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import {
  AllContentListing,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  PostedPostsTable,
  PostedPostsTabs,
  getPostedDashboardData,
  type PostData,
  type LongFormPostData,
  type CombinedContent,
  type QueueType,
  type PostFetcher,
  convertJsonValueToScheduleConfig,
  usePostedPosts,
} from "~/features/posts";
import type { LongFormPostType } from "~/features/posts";
import type { PostStats } from "~/features/posts/stats.server";
import type { User } from "~/features/user";
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

    return data;
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

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function PostedPosts() {
  const data = useLoaderData<LoaderData>();

  // Type assertions for Remix JsonifyObject serialization
  const postsRaw =
    "posts" in data && Array.isArray(data.posts) ? data.posts : [];
  const longformPostsRaw =
    "longformPosts" in data && Array.isArray(data.longformPosts)
      ? data.longformPosts
      : [];
  const allContentRaw =
    "allContent" in data && Array.isArray(data.allContent)
      ? data.allContent
      : [];
  const userRaw = "user" in data ? data.user : null;
  const queueTypesRaw =
    "queueTypes" in data && Array.isArray(data.queueTypes)
      ? data.queueTypes
      : [];

  // Transform serialized dates back to Date objects and assert types
  const posts: PostData[] = Array.isArray(postsRaw)
    ? postsRaw.map((post: unknown) => {
        const p = post as {
          createdAt: string | Date;
          updatedAt: string | Date;
          postedAt?: string | Date | null;
          [key: string]: unknown;
        };
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const result = {
          ...p,
          createdAt:
            p.createdAt &&
            typeof p.createdAt === "object" &&
            p.createdAt instanceof Date
              ? p.createdAt
              : new Date(p.createdAt),
          updatedAt:
            p.updatedAt &&
            typeof p.updatedAt === "object" &&
            p.updatedAt instanceof Date
              ? p.updatedAt
              : new Date(p.updatedAt),
          postedAt: p.postedAt
            ? p.postedAt &&
              typeof p.postedAt === "object" &&
              p.postedAt instanceof Date
              ? p.postedAt
              : new Date(p.postedAt)
            : null,
        } as PostData;
        return result;
      })
    : [];

  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw)
    ? longformPostsRaw.map((post: unknown) => {
        const p = post as {
          createdAt: string | Date;
          updatedAt: string | Date;
          publishedAt?: string | Date | null;
          [key: string]: unknown;
        };
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const result = {
          ...p,
          createdAt:
            p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),
          updatedAt:
            p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),
          publishedAt: p.publishedAt
            ? p.publishedAt instanceof Date
              ? p.publishedAt
              : new Date(p.publishedAt)
            : null,
        } as LongFormPostData;
        return result;
      })
    : [];

  // Type assertions for Remix JsonifyObject serialization
  // Remix serializes Date objects to strings, so we need to assert these types

  const allContent: CombinedContent[] = Array.isArray(allContentRaw)
    ? (allContentRaw as unknown as CombinedContent[])
    : [];

  const user: User | null = userRaw ? (userRaw as unknown as User) : null;
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw.map((qt: unknown) => {
        if (typeof qt !== "object" || qt === null) {
          throw new Error("Invalid queue type");
        }
        const q = qt as {
          id?: unknown;
          name?: unknown;
          color?: unknown;
          scheduleType?: unknown;
          scheduleConfig?: unknown;
          isEnabled?: unknown;
          userId?: unknown;
          createdAt?: unknown;
          updatedAt?: unknown;
        };
        const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
        const name = typeof q.name === "string" ? q.name : String(q.name ?? "");
        const color =
          q.color !== null && q.color !== undefined
            ? typeof q.color === "string"
              ? q.color
              : String(q.color)
            : null;
        const scheduleType =
          typeof q.scheduleType === "string" &&
          (q.scheduleType === "INTERVAL" || q.scheduleType === "FIXED_SLOTS")
            ? q.scheduleType
            : undefined;
        const scheduleConfig = convertJsonValueToScheduleConfig(
          q.scheduleConfig,
        );
        const isEnabled =
          typeof q.isEnabled === "boolean"
            ? q.isEnabled
            : q.isEnabled !== false;
        const userId = typeof q.userId === "string" ? q.userId : "";
        const result: QueueType = {
          id,
          name,
          color,
          description: undefined,
          scheduleType,
          scheduleConfig,
          isEnabled,
          userId,
        };
        return result;
      })
    : [];

  const paginationRaw = "pagination" in data ? data.pagination : undefined;
  const pagination =
    paginationRaw &&
    typeof paginationRaw === "object" &&
    !Array.isArray(paginationRaw) &&
    "total" in paginationRaw &&
    "pages" in paginationRaw &&
    "currentPage" in paginationRaw &&
    "limit" in paginationRaw
      ? {
          total:
            typeof paginationRaw.total === "number" ? paginationRaw.total : 0,
          pages:
            typeof paginationRaw.pages === "number" ? paginationRaw.pages : 0,
          currentPage:
            typeof paginationRaw.currentPage === "number"
              ? paginationRaw.currentPage
              : 1,
          limit:
            typeof paginationRaw.limit === "number" ? paginationRaw.limit : 50,
        }
      : { total: 0, pages: 0, currentPage: 1, limit: 50 };
  const statsRaw = "stats" in data ? data.stats : undefined;
  const stats: Record<string, PostStats> =
    statsRaw && typeof statsRaw === "object" && !Array.isArray(statsRaw)
      ? (statsRaw as Record<string, PostStats>)
      : {};

  const params = useParams();

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
    handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
  } = usePostedPosts({
    user: (() => {
      if (user) return user;
      // Create a minimal User object with required properties

      return {
        id: "",
        npub: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        isEnabled: true,
        timezone: null,
        userRelays: [],
        giveawayBlackListed: [],
        uploadProvider: "S3" as const,
        scheduleInterval: [],
        pendingChildRequests: [],
        pendingParentRequests: [],
      } as unknown as User;
    })(),
    allContent,
    posts,
  });

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "postedAt") {
      const dateA = (
        a.postedAt instanceof Date
          ? a.postedAt
          : a.postedAt
            ? new Date(a.postedAt)
            : new Date(0)
      ).getTime();
      const dateB = (
        b.postedAt instanceof Date
          ? b.postedAt
          : b.postedAt
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

      const aStats =
        aEventId &&
        stats &&
        typeof stats === "object" &&
        !Array.isArray(stats) &&
        aEventId in stats
          ? (stats[aEventId] as unknown as Record<string, unknown>)
          : {};

      const bStats =
        bEventId &&
        stats &&
        typeof stats === "object" &&
        !Array.isArray(stats) &&
        bEventId in stats
          ? (stats[bEventId] as unknown as Record<string, unknown>)
          : {};
      const sortKey = sortConfig.key;
      const aValue =
        typeof sortKey === "string" &&
        sortKey in aStats &&
        typeof aStats[sortKey] === "number"
          ? aStats[sortKey]
          : 0;
      const bValue =
        typeof sortKey === "string" &&
        sortKey in bStats &&
        typeof bStats[sortKey] === "number"
          ? bStats[sortKey]
          : 0;
      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    // Type-safe property access

    const aRecord = a as unknown as Record<string, unknown>;

    const bRecord = b as unknown as Record<string, unknown>;
    const aValue = aRecord[sortConfig.key];
    const bValue = bRecord[sortConfig.key];
    const aTyped =
      typeof aValue === "number" || typeof aValue === "string"
        ? aValue
        : undefined;
    const bTyped =
      typeof bValue === "number" || typeof bValue === "string"
        ? bValue
        : undefined;
    if (aTyped == null && bTyped == null) return 0;
    if (aTyped == null) return sortConfig.direction === "asc" ? -1 : 1;
    if (bTyped == null) return sortConfig.direction === "asc" ? 1 : -1;
    if (aTyped < bTyped) return sortConfig.direction === "asc" ? -1 : 1;
    if (aTyped > bTyped) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const filteredPosts = sortedPosts.filter((post) =>
    post.caption?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
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
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(content) => {
            // Handle selection based on content type
            if (content.type === "post") {
              setSelectedPost(content.originalData as PostData);
            } else {
              setSelectedLongFormPost(
                content.originalData as unknown as LongFormPostData,
              );
            }
          }}
          selectedItems={selectedPosts}
          onToggleSelection={togglePostSelection}
          onToggleSelectAll={() =>
            toggleSelectAll(filteredPosts as PostData[] | CombinedContent[])
          }
          showBulkActions={true}
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={bulkDeleteFetcher.state}
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
                className="block w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
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
                    ? "Processing..."
                    : `Recycle ${selectedPosts.size} Post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleBulkScheduledRepost}
                  disabled={repostFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
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
                    ? "Processing..."
                    : `Repost ${selectedPosts.size} Post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleBulkQuote}
                  disabled={repostFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
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
                    ? "Processing..."
                    : `Quote ${selectedPosts.size} Post${selectedPosts.size !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
                >
                  {bulkDeleteFetcher.state !== "idle"
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
                pagination.total,
              )}{" "}
              of {pagination.total} posts
            </div>
            <div className="flex gap-2">
              <Link
                to={`${params.queueType ? `/dashboard/posted/${params.queueType}` : "/dashboard/posted"}?page=${pagination.currentPage - 1}`}
                className={`rounded-lg border px-3 py-1 ${
                  pagination.currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : "hover:bg-gray-100"
                }`}
              >
                Previous
              </Link>
              <Link
                to={`${params.queueType ? `/dashboard/posted/${params.queueType}` : "/dashboard/posted"}?page=${pagination.currentPage + 1}`}
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
                selectedPost &&
                typeof selectedPost === "object" &&
                "signedEvent" in selectedPost &&
                selectedPost.signedEvent &&
                typeof selectedPost.signedEvent === "object" &&
                "id" in selectedPost.signedEvent &&
                typeof selectedPost.signedEvent.id === "string"
                  ? stats[selectedPost.signedEvent.id]
                  : undefined
              }
              onClose={() => setSelectedPost(null)}
              showStats={true}
              showSignedEvent={true}
              type="posted"
              userTimezone={user?.timezone ?? undefined}
            />
          ) : null}
        </div>
      ) : (
        /* Longform Posts Content */
        <LongFormListing
          posts={longformPosts as unknown as LongFormPostType[]}
          type="posted"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as unknown as LongFormPostData);
          }}
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost as unknown as LongFormPostType}
          onClose={() => setSelectedLongFormPost(null)}
          type="posted"
          showSignedEvent={true}
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      {/* Toast Notification */}
      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
