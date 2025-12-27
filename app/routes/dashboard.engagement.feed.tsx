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
async function loaderImpl({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50; // Get last 50 posts

  const data = await loadEngagementFeedData(userId, page, limit);

  return json(data);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    return await loaderImpl({ request });
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
};

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

interface SafeLoaderData {
  posts: unknown[];
  stats: Record<string, unknown>;
  user: Record<string, unknown> | null;
  groupedNotifications: {
    replies: unknown[];
    quotes: unknown[];
  };
  trustScores: Record<string, unknown>;
}

export default function PostedPosts() {
  const rawData = useLoaderData<LoaderData | SafeLoaderData>();
  
  // Type guard to safely extract data - use explicit type assertions to avoid error typed values
  const rawDataObj = rawData && typeof rawData === "object" && !Array.isArray(rawData) ? rawData : null;
  const posts: unknown[] = Array.isArray(rawDataObj?.posts) ? rawDataObj.posts : [];
  const stats: Record<string, unknown> = rawDataObj && "stats" in rawDataObj && rawDataObj.stats && typeof rawDataObj.stats === "object" && !Array.isArray(rawDataObj.stats) ? rawDataObj.stats as Record<string, unknown> : {};
  const user: Record<string, unknown> | null = rawDataObj && "user" in rawDataObj ? (rawDataObj.user && typeof rawDataObj.user === "object" && !Array.isArray(rawDataObj.user) ? rawDataObj.user as Record<string, unknown> : null) : null;
  const groupedNotifications: { replies: unknown[]; quotes: unknown[] } = rawDataObj && "groupedNotifications" in rawDataObj && rawDataObj.groupedNotifications && typeof rawDataObj.groupedNotifications === "object" && !Array.isArray(rawDataObj.groupedNotifications) ? rawDataObj.groupedNotifications as { replies: unknown[]; quotes: unknown[] } : { replies: [], quotes: [] };
  const trustScores: Record<string, unknown> = rawDataObj && "trustScores" in rawDataObj && rawDataObj.trustScores && typeof rawDataObj.trustScores === "object" && !Array.isArray(rawDataObj.trustScores) ? rawDataObj.trustScores as Record<string, unknown> : {};

  const { selectedPost, activeTab, setSelectedPost, setActiveTab } =
    useEngagementState();

  // Type guard for groupedNotifications
  const safeGroupedNotifications = groupedNotifications;
  const replies = Array.isArray(safeGroupedNotifications.replies) ? safeGroupedNotifications.replies : [];
  const quotes = Array.isArray(safeGroupedNotifications.quotes) ? safeGroupedNotifications.quotes : [];

  // Type guard for user
  const safeUser = user && typeof user === "object" && !Array.isArray(user) ? user : null;
  const userTimezone = safeUser && "timezone" in safeUser && typeof safeUser.timezone === "string" ? safeUser.timezone : undefined;
  const userRelays = safeUser && "userRelays" in safeUser ? safeUser.userRelays : undefined;

  // Type guard for posts
  const safePosts = posts;

  // Type guard for trustScores
  const safeTrustScores = trustScores;

  return (
    <div>
      <EngagementHeader />

      <EngagementTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        repliesCount={replies.length}
        quotesCount={quotes.length}
      />

      <EngagementContent
        activeTab={activeTab}
        groupedNotifications={safeGroupedNotifications}
        userTimezone={userTimezone}
        userRelays={userRelays}
        trustScores={safeTrustScores}
        postsCount={safePosts.length}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as { id: string; caption?: string; fileUrl?: string[]; signedEvent?: unknown; queueType?: { name: string } | null }}
          stats={selectedPost && typeof selectedPost === "object" && "signedEvent" in selectedPost && selectedPost.signedEvent && typeof selectedPost.signedEvent === "object" && "id" in selectedPost.signedEvent && typeof selectedPost.signedEvent.id === "string" && stats && typeof stats === "object" && !Array.isArray(stats) ? stats[selectedPost.signedEvent.id] : undefined}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={userTimezone}
        />
      ) : null}
    </div>
  );
}
