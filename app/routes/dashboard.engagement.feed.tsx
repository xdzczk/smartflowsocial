import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { requireUserId } from "~/features/auth/session.server";
import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import GroupedNotificationList from "~/features/engagement/components/GroupedNotificationList";
import {
  parseThreadViewNotifications,
  groupNotificationsByType,
  groupNotificationsByParent,
  processQuoteReposts,
  type Notification,
} from "~/features/engagement/engagement.server";
import { calculateTrustScore, type User } from "~/features/engagement/trustScore";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { getPostedPosts } from "~/models/post.server";
import { getUserById } from "~/models/user.server";

/**
 * Fetches user profile data from Primal API and converts to User type for trust scoring
 */
async function fetchUserProfile(pubkey: string): Promise<User | null> {
  try {
    const profileData = await connectToPrimalCache("user_profile", { pubkey });

    if (!Array.isArray(profileData)) {
      return null;
    }

    // Find kind 0 (profile) and kind 10000105 (stats) events
    let profileEvent = null;
    let statsEvent = null;

    for (const item of profileData) {
      if (!Array.isArray(item) || item[0] !== "EVENT") continue;
      const event = item[2];
      if (!event) continue;

      if (event.kind === 0) {
        profileEvent = event;
      } else if (event.kind === 10000105) {
        statsEvent = event;
      }
    }

    // Parse profile data
    let profile: any = {};
    if (profileEvent && profileEvent.content) {
      try {
        profile = JSON.parse(profileEvent.content);
      } catch (e) {
        console.error("Failed to parse profile content:", e);
      }
    }

    // Parse stats data
    let stats: any = {};
    if (statsEvent && statsEvent.content) {
      try {
        stats = JSON.parse(statsEvent.content);
      } catch (e) {
        console.error("Failed to parse stats content:", e);
      }
    }

    // Convert to User type
    const user: User = {
      pubkey,
      name: profile.name || undefined,
      displayName: profile.display_name || undefined,
      about: profile.about || undefined,
      picture: profile.picture || undefined,
      nip05: profile.nip05 || undefined,
      lud16: profile.lud16 || undefined,
      followsCount: stats.follows_count || 0,
      followersCount: stats.followers_count || 0,
      noteCount: stats.note_count || 0,
      replyCount: stats.reply_count || 0,
      timeJoined: stats.time_joined || 0,
      zapCount: stats.total_zap_count || 0,
      totalSatsZapped: stats.total_satszapped || 0,
      mediaCount: stats.media_count || 0,
    };

    return user;
  } catch (error) {
    console.error(`Failed to fetch user profile for ${pubkey}:`, error);
    return null;
  }
}

export async function loader({ request, params }) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50; // Get last 50 posts

    const [{ posts }, user] = await Promise.all([
      getPostedPosts({
        userId,
        page,
        limit,
        queueType: "all",
      }),
      getUserById(userId),
    ]);

    // Validate user data to prevent undefined errors
    if (!user) {
      throw new Error("User not found");
    }

    // Ensure user has required properties with safe defaults
    user.npub = user.npub || "";
    user.filterMuted = user.filterMuted ?? false;
    user.hidePostsFromLowTrustUsers = user.hidePostsFromLowTrustUsers ?? false;
    user.mutedList = user.mutedList || { npubs: [] };

    // Get event IDs from signedEvent.id
    const eventIds = posts.map((post) => post.signedEvent.id);

    let stats = {};
    let allNotifications: Notification[] = [];
    const userProfilesMap = new Map<string, User>();
    const trustScoresMap = new Map<string, number>();

    try {
      // Batch fetch notifications and stats to reduce API calls and avoid MaxListenersExceededWarning
      // Split event IDs into batches of 10
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
        batches.push(eventIds.slice(i, i + BATCH_SIZE));
      }

      // Fetch thread_view for stats and notifications with timeout
      const fetchThreadViewWithTimeout = async (
        eventId: string,
        timeout = 5000,
      ) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeout),
        );

        const fetchPromise = connectToPrimalCache("thread_view", {
          event_id: eventId,
        });

        return Promise.race([fetchPromise, timeoutPromise]);
      };

      // Process batches in parallel with individual AbortControllers
      const batchPromises = batches.map(async (batchIds) => {
        const notificationPromises = batchIds.map(async (eventId) => {
          try {
            // Fetch thread_view with timeout - contains stats, replies, and all interaction data
            const threadViewData = await fetchThreadViewWithTimeout(eventId);

            // Parse notifications from thread_view response
            const notifications = parseThreadViewNotifications(
              threadViewData as any,
              eventId,
              user.npub,
            );

            // Find the stats event in the thread_view response for the parent post
            const statsEvent = (threadViewData as any[]).find(
              (event: any) =>
                Array.isArray(event) &&
                event[0] === "EVENT" &&
                event[2] &&
                event[2].kind === 10000100 &&
                event[2].content &&
                event[2].content.includes(eventId),
            );

            let eventStats = {
              likes: 0,
              replies: 0,
              mentions: 0,
              reposts: 0,
              zaps: 0,
              satszapped: 0,
            };

            if (statsEvent) {
              const content = JSON.parse(statsEvent[2].content);
              eventStats = {
                likes: content.likes || 0,
                replies: content.replies || 0,
                mentions: content.mentions || 0,
                reposts: content.reposts || 0,
                zaps: content.zaps || 0,
                satszapped: content.satszapped || 0,
              };
            }

            return {
              eventId,
              stats: eventStats,
              notifications,
            };
          } catch (error) {
            // Silently handle errors for events without thread_view data
            return {
              eventId,
              stats: {
                likes: 0,
                replies: 0,
                mentions: 0,
                reposts: 0,
                zaps: 0,
                satszapped: 0,
              },
              notifications: [],
            };
          }
        });

        return Promise.all(notificationPromises);
      });

      const allBatchResults = await Promise.all(batchPromises);
      const results = allBatchResults.flat();

      // Combine stats and notifications with safety checks
      stats = results.reduce((acc, result) => {
        if (result && result.eventId && result.stats) {
          acc[result.eventId] = result.stats;
        }
        return acc;
      }, {});

      allNotifications = results.flatMap((result) =>
        result && Array.isArray(result.notifications) ? result.notifications : [],
      );

      // Filter out muted users if enabled
      if (
        user.filterMuted &&
        user.mutedList?.npubs &&
        Array.isArray(user.mutedList.npubs) &&
        user.mutedList.npubs.length > 0
      ) {
        const mutedPubkeys = user.mutedList.npubs;

        allNotifications = allNotifications.filter((notification) => {
          // For zaps, check senderPubkey; for replies and mentions, check pubkey
          const pubkeyToCheck =
            notification.type === "zap"
              ? notification.senderPubkey
              : notification.pubkey;

          return !mutedPubkeys.includes(pubkeyToCheck);
        });
      }

      // Fetch user profiles and calculate trust scores
      const uniquePubkeys = Array.from(
        new Set(
          allNotifications.map((notification) =>
            notification.type === "zap"
              ? notification.senderPubkey
              : notification.pubkey,
          ),
        ),
      );


      // Fetch profiles in parallel
      const profilePromises = uniquePubkeys.map(async (pubkey) => {
        const userProfile = await fetchUserProfile(pubkey);
        if (userProfile) {
          userProfilesMap.set(pubkey, userProfile);
          const trustScore = calculateTrustScore(userProfile);
          trustScoresMap.set(pubkey, trustScore);
        }
      });

      await Promise.all(profilePromises);


      // Filter out low trust users if enabled (score < 40 = "Developing" or lower)
      if (user.hidePostsFromLowTrustUsers) {
        const beforeFilterCount = allNotifications.length;
        allNotifications = allNotifications.filter((notification) => {
          const pubkeyToCheck =
            notification.type === "zap"
              ? notification.senderPubkey
              : notification.pubkey;

          const trustScore = trustScoresMap.get(pubkeyToCheck);
          // If we don't have a trust score (failed to fetch), allow it through
          // Otherwise, only allow if trust score >= 40
          return trustScore === undefined || trustScore >= 40;
        });
        const afterFilterCount = allNotifications.length;
      }
    } catch (error) {
      console.error("📊 [SERVER] Error fetching stats:", error);
      // Gracefully handle any overall errors
      stats = posts.reduce((acc, post) => {
        acc[post.signedEvent.id] = {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        };
        return acc;
      }, {});
    }

    // Group notifications by type
    const groupedNotifications = groupNotificationsByType(allNotifications);

    // Group notifications by parent event - focus on replies only
    const groupedByParent = {
      replies: groupNotificationsByParent(
        groupedNotifications.replies,
        posts,
        [], // No longform posts in this feed
        stats,
      ),
    };

    // Filter posts to only show those with replies
    const postsWithReplies = posts.filter((post) => {
      const postStats = stats[post.signedEvent.id];
      return postStats && postStats.replies > 0;
    });

    // Fetch quote reposts using get_notifications
    let quoteRepostNotifications: any[] = [];
    let groupedQuoteReposts: any[] = [];
    try {

      const notificationsData = await connectToPrimalCache("get_notifications", {
        pubkey: user.npub,
        limit: 100,
      });


      // Extract quote reposts (kind 1 events with mention tags)
      if (Array.isArray(notificationsData)) {

        const rawQuoteReposts = notificationsData
          .filter((item: any) => {
            // Filter kind 1 events
            if (
              Array.isArray(item) &&
              item[0] === "EVENT" &&
              item[2]?.kind === 1
            ) {
              const event = item[2];

              // Safety check: ensure event has required properties
              if (
                !event.id ||
                !event.pubkey ||
                typeof event.content !== "string"
              ) {
                return false;
              }

              const tags = event.tags || [];


              // Skip if it's the user's own post
              if (event.pubkey === user.npub) {
                return false;
              }

              // Check if it has both "e" and "p" tags with mention marker
              const eMentionTags = tags.filter(
                (tag: any[]) => tag[0] === "e" && tag[3] === "mention",
              );
              const hasEMention = eMentionTags.length > 0;

              const pMentionTags = tags.filter(
                (tag: any[]) =>
                  tag[0] === "p" && (tag[3] === "mention" || tag[3] === ""),
              );
              const hasPMention = pMentionTags.length > 0;


              if (!hasEMention) {
                return false;
              }

              if (!hasPMention) {
                return false;
              }

              // Check if the mentioned user (p tag) is the current user
              const mentionedUserPubkey = tags.find(
                (tag: any[]) =>
                  tag[0] === "p" && (tag[3] === "mention" || tag[3] === ""),
              )?.[1];
              const isMentioningUser = mentionedUserPubkey === user.npub;

              if (!isMentioningUser) {
                return false;
              }

              return true;
            }
            return false;
          })
          .map((item: any) => item[2]); // Extract the event object

        // Process quote reposts with the new function
        if (rawQuoteReposts.length > 0) {
          quoteRepostNotifications = await processQuoteReposts(
            rawQuoteReposts,
            connectToPrimalCache,
          );


          // Filter out muted users if enabled
          if (
            user.filterMuted &&
            user.mutedList?.npubs &&
            Array.isArray(user.mutedList.npubs) &&
            user.mutedList.npubs.length > 0
          ) {
            const mutedPubkeys = user.mutedList.npubs;
            quoteRepostNotifications = quoteRepostNotifications.filter(
              (notification) => {
                return !mutedPubkeys.includes(notification.pubkey);
              },
            );
          }

          // Fetch user profiles and calculate trust scores for quote reposts
          const quoteUniquePubkeys = Array.from(
            new Set(
              quoteRepostNotifications.map((notification) => notification.pubkey),
            ),
          );


          const quoteProfilePromises = quoteUniquePubkeys.map(async (pubkey) => {
            // Reuse existing profile if already fetched
            if (!userProfilesMap.has(pubkey)) {
              const userProfile = await fetchUserProfile(pubkey);
              if (userProfile) {
                userProfilesMap.set(pubkey, userProfile);
                const trustScore = calculateTrustScore(userProfile);
                trustScoresMap.set(pubkey, trustScore);
              }
            }
          });

          await Promise.all(quoteProfilePromises);

          // Filter out low trust users from quote reposts if enabled
          if (user.hidePostsFromLowTrustUsers) {
            const beforeFilterCount = quoteRepostNotifications.length;
            quoteRepostNotifications = quoteRepostNotifications.filter(
              (notification) => {
                const trustScore = trustScoresMap.get(notification.pubkey);
                return trustScore === undefined || trustScore >= 40;
              },
            );
            const afterFilterCount = quoteRepostNotifications.length;
          }

          // Group quote reposts by parent post
          groupedQuoteReposts = groupNotificationsByParent(
            quoteRepostNotifications,
            posts,
            [], // No longform posts in this feed
            stats,
          );
        }
      }
    } catch (error) {
      console.error(
        "🔍 [QUOTE REPOST DEBUG] Error fetching quote reposts:",
        error,
      );
    }

    // Convert trust scores map to object for JSON serialization
    const trustScores: Record<string, number> = {};
    trustScoresMap.forEach((score, pubkey) => {
      trustScores[pubkey] = score;
    });

    // Ensure all data has safe defaults
    return json({
      posts: postsWithReplies || [],
      stats: stats || {},
      user: user || {},
      notifications: groupedNotifications || { all: [], replies: [], mentions: [], zaps: [], quotes: [] },
      groupedNotifications: {
        replies: groupedByParent?.replies || [],
        quotes: groupedQuoteReposts || [],
      },
      trustScores: trustScores || {},
    });
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
    notifications,
    groupedNotifications,
    trustScores,
  } = useLoaderData();

  const [selectedPost, setSelectedPost] = useState(null);
  const [activeTab, setActiveTab] = useState<"all" | "replies" | "quotes">(
    "all",
  );

  return (
    <div>
      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Engagement Feed</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            See who's engaging with your posts
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("all")}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${activeTab === "all"
              ? "border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
              }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("replies")}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${activeTab === "replies"
              ? "border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
              }`}
          >
            Replies ({groupedNotifications.replies.length})
          </button>
          <button
            onClick={() => setActiveTab("quotes")}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${activeTab === "quotes"
              ? "border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
              }`}
          >
            Repost with Quote ({groupedNotifications.quotes?.length || 0})
          </button>
        </nav>
      </div>

      {/* All Tab Content */}
      {activeTab === "all" ? <div className="space-y-6">
        {/* Replies Section */}
        {groupedNotifications.replies.length > 0 ? <div>
          <h4 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Replies
          </h4>
          <GroupedNotificationList
            groupedNotifications={groupedNotifications.replies}
            userTimezone={user?.timezone}
            userRelays={user?.userRelays || ["wss://relay.primal.net"]}
            trustScores={trustScores}
          />
        </div> : null}

        {/* Quote Reposts Section */}
        {groupedNotifications.quotes &&
          groupedNotifications.quotes.length > 0 ? <div>
          <h4 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Repost with Quote
          </h4>
          <GroupedNotificationList
            groupedNotifications={groupedNotifications.quotes}
            userTimezone={user?.timezone}
            userRelays={user?.userRelays || ["wss://relay.primal.net"]}
            trustScores={trustScores}
          />
        </div> : null}

        {groupedNotifications.replies.length === 0 &&
          (!groupedNotifications.quotes ||
            groupedNotifications.quotes.length === 0) ? <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No engagement found for your posts yet.
          </p>
        </div> : null}
      </div> : null}

      {/* Replies Tab Content */}
      {activeTab === "replies" ? <>
        {groupedNotifications.replies.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedNotifications.replies}
            userTimezone={user?.timezone}
            userRelays={user?.userRelays || ["wss://relay.primal.net"]}
            trustScores={trustScores}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">
              No replies found for your posts.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Posts fetched: {posts.length}
            </p>
          </div>
        )}
      </> : null}

      {/* Quote Reposts Tab Content */}
      {activeTab === "quotes" ? <>
        {groupedNotifications.quotes &&
          groupedNotifications.quotes.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedNotifications.quotes}
            userTimezone={user?.timezone}
            userRelays={user?.userRelays || ["wss://relay.primal.net"]}
            trustScores={trustScores}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">
              No quote reposts found for your posts.
            </p>
          </div>
        )}
      </> : null}

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          stats={stats[selectedPost.signedEvent.id]}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone}
        />
      ) : null}
    </div>
  );
}
