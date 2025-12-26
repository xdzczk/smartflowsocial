import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { EngagementContent } from "~/features/engagement/components/EngagementContent";
import { EngagementHeader } from "~/features/engagement/components/EngagementHeader";
import { EngagementTabs } from "~/features/engagement/components/EngagementTabs";
import { useEngagementState } from "~/features/engagement/hooks/useEngagementState";
import { loadEngagementFeedData } from "~/features/engagement/services/engagement-loader.server";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50; // Get last 50 posts

    const data = await loadEngagementFeedData(userId, page, limit);

    return json(data);
  } catch (error) {
    // Return safe default data on error using centralized error handling
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      posts: [],
      stats: {},
      user: {},
      notifications: { all: [], replies: [], mentions: [], zaps: [], quotes: [] },
      groupedNotifications: {
        replies: [],
        quotes: [],
      },
      trustScores: {},
    });
  }
}

export default function PostedPosts() {
  const {
    posts,
    stats,
    user,
    groupedNotifications,
    trustScores,
  } = useLoaderData<typeof loader>();

  const { selectedPost, activeTab, setSelectedPost, setActiveTab } =
    useEngagementState();

  return (
    <div>
      <EngagementHeader />

      <EngagementTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        repliesCount={groupedNotifications.replies.length}
        quotesCount={groupedNotifications.quotes?.length || 0}
      />

      <EngagementContent
        activeTab={activeTab}
        groupedNotifications={groupedNotifications}
        userTimezone={user?.timezone}
        userRelays={user?.userRelays}
        trustScores={trustScores}
        postsCount={posts.length}
      />

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
    </div>
  );
}
