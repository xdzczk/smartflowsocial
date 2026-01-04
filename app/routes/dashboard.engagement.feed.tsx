import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  EngagementContent,
  EngagementHeader,
  EngagementTabs,
  useEngagementState,
  loadEngagementFeedData,
  useEngagementData,
} from "~/features/engagement";
import { requireAnySubscription } from "~/features/payments";
import { PostDetailsModal } from "~/features/posts/ui";
import { type PostData } from "~/features/posts/server";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { engagementLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
async function loaderImpl({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 50; // Get last 50 posts

  const data = await loadEngagementFeedData(userId, page, limit);

  // Validate loader response with Zod schema
  return json(validateLoaderResponse(data, engagementLoaderDataSchema));
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
      notifications: {
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      },
      groupedNotifications: {
        replies: [],
        quotes: [],
      },
      trustScores: {},
    });
  }
};

type _LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default function PostedPosts() {
  // Use TanStack Query for data fetching with caching
  const {
    posts: safePosts,
    stats: safeStats,
    user: safeUser,
    groupedNotifications: safeGroupedNotifications,
    trustScores: safeTrustScores,
  } = useEngagementData();

  const { selectedPost, activeTab, setSelectedPost, setActiveTab } =
    useEngagementState();

  // Extract user properties
  const userTimezone =
    safeUser && "timezone" in safeUser && typeof safeUser.timezone === "string"
      ? safeUser.timezone
      : undefined;
  const userRelays =
    safeUser && "userRelays" in safeUser && Array.isArray(safeUser.userRelays)
      ? (safeUser.userRelays as string[])
      : undefined;

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

      {selectedPost &&
      typeof selectedPost === "object" &&
      "id" in selectedPost ? (
        <PostDetailsModal
          post={selectedPost as PostData}
          stats={(() => {
            if (
              selectedPost &&
              typeof selectedPost === "object" &&
              "signedEvent" in selectedPost
            ) {
              const signedEvent = selectedPost.signedEvent;
              if (
                signedEvent &&
                typeof signedEvent === "object" &&
                "id" in signedEvent &&
                typeof signedEvent.id === "string"
              ) {
                const eventId = signedEvent.id;
                return safeStats[eventId];
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
