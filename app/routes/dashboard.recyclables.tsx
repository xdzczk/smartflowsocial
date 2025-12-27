import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams, useFetcher } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { RecyclablesBulkActions } from "~/features/posts/components/RecyclablesBulkActions";
import { RecyclablesPagination } from "~/features/posts/components/RecyclablesPagination";
import { RecyclablesQueueTabs } from "~/features/posts/components/RecyclablesQueueTabs";
import { RecyclablesSearch } from "~/features/posts/components/RecyclablesSearch";
import { RecyclablesTable } from "~/features/posts/components/RecyclablesTable";
import { RecyclablesToast } from "~/features/posts/components/RecyclablesToast";
import { useRecyclablesState } from "~/features/posts/hooks/useRecyclablesState";
import {
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "~/features/posts/posts.server";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

async function loaderImpl({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to recyclables feature
  await requireFeatureAccess(userId, "recyclables");

  const url = new URL(request.url);

  const data = await getRecyclableDashboardData({ userId, params, url });

  return data;
}

export const loader = withErrorHandling(loaderImpl);

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  return handleRecyclablePostAction(formData, userId);
});

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

interface RepostFetcherData {
  repostData?: unknown;
  scheduledRepostData?: unknown;
  quotePostData?: unknown;
}

export default function RecyclablesPosts() {
  const data = useLoaderData<LoaderData>();
  const { posts, pagination, stats, user, queueTypes } = data;
  const params = useParams();

  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher<RepostFetcherData>();
  const individualRepostFetcher = useFetcher<RepostFetcherData>();

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
    posts,
    stats,
    user,
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
        posts={filteredPosts as unknown as { id: string; caption?: string; fileUrl?: string[]; postedAt?: Date | string; signedEvent?: unknown }[]}
        stats={stats}
        sortConfig={sortConfig}
        selectedPosts={selectedPosts}
        onRequestSort={requestSort}
        onPostClick={(post) => setSelectedPost(post as unknown as { id: string; caption?: string; fileUrl?: string[]; signedEvent?: unknown } | null)}
        onToggleSelect={togglePostSelection}
        onToggleSelectAll={toggleSelectAll}
        deleteFetcher={deleteFetcher}
        individualRepostFetcher={individualRepostFetcher}
        bulkDeleteFetcher={bulkDeleteFetcher}
      />

      <RecyclablesPagination pagination={pagination} />

      {selectedPost ? (
        <PostDetailsModal
              post={selectedPost as unknown as { id: string; caption?: string; fileUrl?: string[]; signedEvent?: unknown; queueType?: { name: string } | null }}
          stats={stats[((selectedPost && typeof selectedPost === "object" && "signedEvent" in selectedPost && selectedPost.signedEvent && typeof selectedPost.signedEvent === "object" && "id" in selectedPost.signedEvent) ? String((selectedPost.signedEvent as { id?: string }).id) : "") || ""]}
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
