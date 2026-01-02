import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams, useFetcher } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  PostDetailsModal,
  RecyclablesBulkActions,
  RecyclablesPagination,
  RecyclablesQueueTabs,
  RecyclablesSearch,
  RecyclablesTable,
  RecyclablesToast,
  useRecyclablesState,
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "~/features/posts";
import type { IndividualRepostFetcherData } from "~/features/posts";
import type { PostData, CombinedContent } from "~/features/posts";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to recyclables feature
    await requireFeatureAccess(userId, "recyclables");

    const url = new URL(request.url);

    const data = await getRecyclableDashboardData({ userId, params, url });

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

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();

    return handleRecyclablePostAction(formData, userId);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

interface RepostFetcherData {
  repostData?: unknown;
  scheduledRepostData?: unknown;
  quotePostData?: unknown;
}

export default function RecyclablesPosts() {
  const data = useLoaderData<LoaderData>();
  const posts = "posts" in data && Array.isArray(data.posts) ? data.posts : [];
  const pagination = "pagination" in data ? data.pagination : undefined;
  const stats = "stats" in data ? data.stats : undefined;
  const user = "user" in data ? data.user : null;
  const queueTypes = "queueTypes" in data && Array.isArray(data.queueTypes) ? data.queueTypes : [];
  const params = useParams();

  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher<RepostFetcherData>();
  const individualRepostFetcher = useFetcher<IndividualRepostFetcherData>();

  // Type assertions for posts - ensure they match Post[] | PostData[]
  const typedPosts: PostData[] = Array.isArray(posts) ? posts.map((post: unknown) => {
    const p = post as { id: string; createdAt?: string | Date; postedAt?: string | Date | null; [key: string]: unknown };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt : typeof p.createdAt === "string" ? new Date(p.createdAt) : new Date(),
      postedAt: p.postedAt instanceof Date ? p.postedAt : typeof p.postedAt === "string" ? new Date(p.postedAt) : p.postedAt === null ? null : null,
    } as PostData;
    return result;
  }) : [];
  
  // Type assertions for stats - ensure it matches Stats type
  const typedStats: Record<string, {
    likes?: number;
    replies?: number;
    mentions?: number;
    reposts?: number;
    zaps?: number;
    satszapped?: number;
  }> = stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
  
  // Type assertion for pagination
  const typedPagination = pagination && typeof pagination === "object" && !Array.isArray(pagination) && "total" in pagination && "pages" in pagination && "currentPage" in pagination && "limit" in pagination ? {
    total: typeof pagination.total === "number" ? pagination.total : 0,
    pages: typeof pagination.pages === "number" ? pagination.pages : 0,
    currentPage: typeof pagination.currentPage === "number" ? pagination.currentPage : 1,
    limit: typeof pagination.limit === "number" ? pagination.limit : 50,
  } : { total: 0, pages: 0, currentPage: 1, limit: 50 };
  
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
      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
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
        currentQueueType={params.queueType}
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
        posts={filteredPosts.map((post): { id: string; caption?: string | null; postedAt: Date | null; fileUrl: string[]; signedEvent: { id: string }; queueType?: { name: string; color?: string | null } | null; status?: string } => ({
          id: post.id,
          caption: post.caption ?? null,
          postedAt: post.postedAt instanceof Date ? post.postedAt : typeof post.postedAt === "string" ? new Date(post.postedAt) : post.postedAt === null ? null : null,
          fileUrl: Array.isArray(post.fileUrl) ? post.fileUrl : post.fileUrl ? [post.fileUrl] : [],
          signedEvent: post.signedEvent && typeof post.signedEvent === "object" && "id" in post.signedEvent ? { id: String(post.signedEvent.id) } : { id: "" },
          queueType: post.queueType ? { name: post.queueType.name, color: post.queueType.color ?? null } : null,
          status: typeof post.status === "string" ? post.status : undefined,
        }))}
        stats={typedStats}
        sortConfig={sortConfig}
        selectedPosts={selectedPosts}
        onRequestSort={requestSort}
        onPostClick={(post) => {
          // Find the original PostData from typedPosts array
          const originalPostData = typedPosts.find(p => p.id === post.id);
          if (originalPostData) {
            // Convert to the Post format expected by useRecyclablesState
            // useRecyclablesState expects Post with postedAt: Date | null, fileUrl: string[], signedEvent: { id: string }
            setSelectedPost({
              ...originalPostData,
              postedAt: originalPostData.postedAt instanceof Date ? originalPostData.postedAt : typeof originalPostData.postedAt === "string" ? new Date(originalPostData.postedAt) : null,
              fileUrl: Array.isArray(originalPostData.fileUrl) ? originalPostData.fileUrl : typeof originalPostData.fileUrl === "string" ? [originalPostData.fileUrl] : [],
              signedEvent: originalPostData.signedEvent && typeof originalPostData.signedEvent === "object" && "id" in originalPostData.signedEvent ? { id: String(originalPostData.signedEvent.id) } : { id: "" },
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
            const eventId = (selectedPost && typeof selectedPost === "object" && "signedEvent" in selectedPost && selectedPost.signedEvent && typeof selectedPost.signedEvent === "object" && "id" in selectedPost.signedEvent) ? String((selectedPost.signedEvent as { id?: string }).id) : "";
            const statsEntry = typedStats[eventId];
            // Ensure all required properties are present with defaults
            return statsEntry ? {
              likes: statsEntry.likes ?? 0,
              replies: statsEntry.replies ?? 0,
              mentions: statsEntry.mentions ?? 0,
              reposts: statsEntry.reposts ?? 0,
              zaps: statsEntry.zaps ?? 0,
              satszapped: statsEntry.satszapped ?? 0,
            } : undefined;
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
