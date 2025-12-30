import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import {
  EngagementContent,
  EngagementHeader,
  EngagementTabs,
  useEngagementState,
  loadEngagementFeedData,
  type GroupedNotification,
  type EventStats,
} from "~/features/engagement";
import {
  requireAnySubscription,
} from "~/features/payments";
import {
  PostDetailsModal,
  type PostData,
} from "~/features/posts";
async function loaderImpl({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 50; // Get last 50 posts

  const data = await loadEngagementFeedData(userId, page, limit);

  return json(data);
}

export const loader = async (args: LoaderFunctionArgs) => {
  try {
    return await loaderImpl(args);
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
  const rawDataObj = rawData && typeof rawData === "object" && !Array.isArray(rawData) ? rawData as Record<string, unknown> : null;
  const posts: unknown[] = rawDataObj && "posts" in rawDataObj && Array.isArray(rawDataObj.posts) ? (rawDataObj.posts as unknown[]) : [];
  const stats: Record<string, unknown> = rawDataObj && "stats" in rawDataObj && rawDataObj.stats && typeof rawDataObj.stats === "object" && !Array.isArray(rawDataObj.stats) ? (rawDataObj.stats as unknown as Record<string, unknown>) : {};
  const user: Record<string, unknown> | null = rawDataObj && "user" in rawDataObj ? (rawDataObj.user && typeof rawDataObj.user === "object" && !Array.isArray(rawDataObj.user) ? (rawDataObj.user as unknown as Record<string, unknown>) : null) : null;
  const groupedNotifications: { replies: unknown[]; quotes: unknown[] } = rawDataObj && "groupedNotifications" in rawDataObj && rawDataObj.groupedNotifications && typeof rawDataObj.groupedNotifications === "object" && !Array.isArray(rawDataObj.groupedNotifications) ? (rawDataObj.groupedNotifications as unknown as { replies: unknown[]; quotes: unknown[] }) : { replies: [], quotes: [] };
  const trustScores: Record<string, unknown> = rawDataObj && "trustScores" in rawDataObj && rawDataObj.trustScores && typeof rawDataObj.trustScores === "object" && !Array.isArray(rawDataObj.trustScores) ? rawDataObj.trustScores as Record<string, unknown> : {};

  const { selectedPost, activeTab, setSelectedPost, setActiveTab } =
    useEngagementState();

  // Type guard for groupedNotifications
  const safeGroupedNotifications: { replies: GroupedNotification[]; quotes: GroupedNotification[] } = {
    replies: Array.isArray(groupedNotifications.replies) ? groupedNotifications.replies as unknown as GroupedNotification[] : [],
    quotes: Array.isArray(groupedNotifications.quotes) ? groupedNotifications.quotes as unknown as GroupedNotification[] : [],
  };

  // Type guard for user
  const safeUser = user && typeof user === "object" && !Array.isArray(user) ? user : null;
  const userTimezone = safeUser && "timezone" in safeUser && typeof safeUser.timezone === "string" ? safeUser.timezone : undefined;
  const userRelays = safeUser && "userRelays" in safeUser && Array.isArray(safeUser.userRelays) ? safeUser.userRelays as string[] : undefined;

  // Type guard for posts
  const safePosts: PostData[] = Array.isArray(posts) ? posts.filter((post): post is PostData => {
    return post !== null && typeof post === "object" && "id" in post && typeof (post as { id: unknown }).id === "string";
  }) : [];

  // Type guard for trustScores
  const safeTrustScores: Record<string, number> = trustScores && typeof trustScores === "object" && !Array.isArray(trustScores) ? Object.fromEntries(
    Object.entries(trustScores).map(([key, value]) => [
      key,
      typeof value === "number" ? value : 0,
    ])
  ) : {};

  return (
    <div>
      <EngagementHeader />

      <EngagementTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        repliesCount={safeGroupedNotifications.replies.length}
        quotesCount={safeGroupedNotifications.quotes.length}
      />

      <EngagementContent
        activeTab={activeTab}
        groupedNotifications={safeGroupedNotifications}
        userTimezone={userTimezone}
        userRelays={userRelays}
        trustScores={safeTrustScores}
        postsCount={safePosts.length}
      />

      {selectedPost && typeof selectedPost === "object" && "id" in selectedPost ? (
        <PostDetailsModal
          post={selectedPost as PostData}
          stats={(() => {
            if (selectedPost && typeof selectedPost === "object" && "signedEvent" in selectedPost) {
              const signedEvent = selectedPost.signedEvent;
              if (signedEvent && typeof signedEvent === "object" && "id" in signedEvent && typeof signedEvent.id === "string") {
                const eventId = signedEvent.id;
                if (stats && typeof stats === "object" && !Array.isArray(stats) && eventId in stats) {
                  const statsValue = stats[eventId];
                  return statsValue && typeof statsValue === "object" && !Array.isArray(statsValue) ? statsValue as EventStats : undefined;
                }
              }
            }
            return undefined;
          })()}
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
