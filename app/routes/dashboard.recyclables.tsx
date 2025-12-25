import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams, useFetcher } from "@remix-run/react";

import {
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "~/features/posts/posts.server";
import { requireUserId } from "~/features/auth/session.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { RecyclablesSearch } from "~/features/posts/components/RecyclablesSearch";
import { RecyclablesQueueTabs } from "~/features/posts/components/RecyclablesQueueTabs";
import { RecyclablesBulkActions } from "~/features/posts/components/RecyclablesBulkActions";
import { RecyclablesTable } from "~/features/posts/components/RecyclablesTable";
import { RecyclablesPagination } from "~/features/posts/components/RecyclablesPagination";
import { RecyclablesToast } from "~/features/posts/components/RecyclablesToast";
import { useRecyclablesState } from "~/features/posts/hooks/useRecyclablesState";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to recyclables feature
  await requireFeatureAccess(userId, "recyclables");

  const url = new URL(request.url);

  const data = await getRecyclableDashboardData({ userId, params, url });

  return json(data);
}

export async function action({ request }: { request: Request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  return handleRecyclablePostAction(formData, userId);
}

export default function RecyclablesPosts() {
  const { posts, pagination, stats, user, queueTypes, selectedQueueType } =
    useLoaderData<typeof loader>();
  const params = useParams();

  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher();
  const individualRepostFetcher = useFetcher();

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
        posts={filteredPosts}
        stats={stats}
        sortConfig={sortConfig}
        selectedPosts={selectedPosts}
        onRequestSort={requestSort}
        onPostClick={setSelectedPost}
        onToggleSelect={togglePostSelection}
        onToggleSelectAll={toggleSelectAll}
        deleteFetcher={deleteFetcher}
        individualRepostFetcher={individualRepostFetcher}
        bulkDeleteFetcher={bulkDeleteFetcher}
      />

      <RecyclablesPagination pagination={pagination} />

      {selectedPost ? (
        <PostDetailsModal
              post={selectedPost}
          stats={stats[selectedPost.signedEvent.id]}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone || undefined}
        />
      ) : null}

      <RecyclablesToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
