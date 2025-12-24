import { json } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useParams,
  useRevalidator,
} from "@remix-run/react";
import { useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { requireUserId } from "~/features/auth/session.server";
import { calculateTrustScore, type User } from "~/features/engagement/trustScore";
import GiveawayRandomizer from "~/features/giveaway/components/GiveawayRandomizer";
import { fetchGiveawayParticipants } from "~/features/giveaway/giveaway.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { getQueueColor } from "~/features/posts/queueColors";
import { formatDate, getImageUrls, convertToHex } from "~/lib/helpers";
import { connectToPrimalCache } from "~/lib/nostrwebsocket.server";
import { getRecentPostedPosts } from "~/models/post.server";
import {
  getGiveawayBlacklist,
  getUserById,
  getQueueTypes,
} from "~/models/user.server";

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
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to giveaway feature
  await requireFeatureAccess(userId, "giveaways");

  const url = new URL(request.url);
  const queueType = params.queueType || "all";

  const days = parseInt(url.searchParams.get("days") || "7");

  const [posts, user, queueTypes] = await Promise.all([
    getRecentPostedPosts({
      userId,
      days,
      queueType,
    }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Get event IDs from signedEvent.id
  const eventIds = posts.map((post) => post.signedEvent.id);

  let stats = {};
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Fetch stats for each event ID
    const statsPromises = eventIds.map(async (eventId) => {
      const response = await fetch(process.env.PRIMAL_CACHING_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "thread_view",
          params: {
            event_id: eventId,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();
      // Find the stats event in the response array

      const statsEvent = data.find(
        (event) =>
          event[0] === "EVENT" &&
          event[2] &&
          event[2].kind === 10000100 &&
          event[2].content &&
          event[2].content.includes(eventId),
      );

      if (statsEvent) {
        const content = JSON.parse(statsEvent[2].content);
        return {
          [eventId]: {
            likes: content.likes || 0,
            replies: content.replies || 0,
            mentions: content.mentions || 0,
            reposts: content.reposts || 0,
            zaps: content.zaps || 0,
            satszapped: content.satszapped || 0,
          },
        };
      }

      return {
        [eventId]: {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      };
    });

    const statsResults = await Promise.all(statsPromises);
    stats = statsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    clearTimeout(timeoutId);
  } catch (error) {
    console.error("Error fetching stats:", error);
    // Initialize empty stats object with 0 values for each post
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

  // Add total engagement to each post
  const postsWithEngagement = posts.map((post) => {
    const postStats = stats[post.signedEvent.id] || {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    };

    const totalEngagement =
      postStats.likes +
      postStats.replies +
      postStats.mentions +
      postStats.reposts +
      postStats.zaps;

    return {
      ...post,
      stats: postStats,
      totalEngagement,
    };
  });

  // Filter posts with engagement
  const postsWithNonZeroEngagement = postsWithEngagement.filter(
    (post) => post.totalEngagement > 0,
  );

  // Extract all post IDs into an array
  const postIds = postsWithNonZeroEngagement.map((post) => post.signedEvent.id);

  // Handle case when there are no posts with engagement
  let relatedEvents: any[] = [];
  if (postIds.length > 0) {
    const result = await fetchGiveawayParticipants(postIds);
    relatedEvents = result.relatedEvents;
  }

  // Filter relatedEvents to only include unique pubkeys
  const uniquePubkeys = new Set();
  const uniqueRelatedEvents = relatedEvents.filter((event) => {
    // If we haven't seen this pubkey before, add it to the set and keep the event
    if (!uniquePubkeys.has(event.pubkey)) {
      uniquePubkeys.add(event.pubkey);
      return true;
    }
    // Otherwise, skip this event as we already have an event from this pubkey
    return false;
  });

  // Replace the original relatedEvents with the filtered version
  relatedEvents = uniqueRelatedEvents;

  // Get blacklisted pubkeys
  const blacklistedPubkeys = await getGiveawayBlacklist(userId);

  const blacklistedSet = new Set(
    blacklistedPubkeys.map((pubkey) => {
      // Convert npub to hex if needed
      return convertToHex(pubkey) || pubkey;
    }),
  );

  // Get muted pubkeys if filtering is enabled
  const mutedSet = new Set<string>();
  if (user.filterMuted && user.mutedList?.npubs && Array.isArray(user.mutedList.npubs)) {
    user.mutedList.npubs.forEach((pubkey) => {
      mutedSet.add(pubkey);
    });
  }

  // Filter relatedEvents to only include users with valid lud16 address and totalZapped > 5
  const filteredRelatedEvents = [];

  // Process events in parallel with Promise.all
  const profilePromises = relatedEvents.map(async (event) => {
    try {
      // Skip blacklisted pubkeys
      if (blacklistedSet.has(event.pubkey)) {
        return null;
      }

      // Skip muted pubkeys
      if (mutedSet.has(event.pubkey)) {
        return null;
      }

      // Fetch user profile data
      const userProfileResponse = await connectToPrimalCache("user_profile", {
        pubkey: event.pubkey,
      });

      // Find user profile event (kind 0)
      const userProfile = userProfileResponse.find(
        (data) => data[0] === "EVENT" && data[2].kind === 0,
      );

      // Find stats event (kind 10000105)
      const statsEvent = userProfileResponse.find(
        (data) => data[0] === "EVENT" && data[2].kind === 10000105,
      );

      let lud16 = null;
      let totalZapped = 0;

      // Extract lud16 from profile
      if (userProfile) {
        const profileContent = JSON.parse(userProfile[2].content);
        lud16 = profileContent.lud16;
      }

      // Extract zap stats
      if (statsEvent) {
        const stats = JSON.parse(statsEvent[2].content);
        totalZapped = stats.total_zap_count ?? 0;
      }

      // Only include users with valid lud16 and totalZapped > 5
      if (lud16 && totalZapped > 5) {
        return event;
      }
      return null;
    } catch (error) {
      return null;
    }
  });

  // Wait for all promises to resolve and filter out null results
  const results = await Promise.all(profilePromises);
  filteredRelatedEvents.push(...results.filter((result) => result !== null));

  // Replace the original relatedEvents with the filtered version
  relatedEvents = filteredRelatedEvents;

  // Filter by trust score if hidePostsFromLowTrustUsers is enabled
  if (user.hidePostsFromLowTrustUsers) {
    // Fetch trust scores for all participants
    const trustScorePromises = relatedEvents.map(async (event) => {
      const userProfile = await fetchUserProfile(event.pubkey);
      if (userProfile) {
        const trustScore = calculateTrustScore(userProfile);
        return { event, trustScore };
      }
      return { event, trustScore: 0 }; // Default to 0 if profile fetch fails
    });

    const trustScoreResults = await Promise.all(trustScorePromises);

    // Filter out users with trust score < 40
    relatedEvents = trustScoreResults
      .filter(({ trustScore }) => trustScore >= 40)
      .map(({ event }) => event);
  }

  return json({
    posts: postsWithNonZeroEngagement,
    stats,
    relatedEvents,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
  });
}

export default function PostedPosts() {
  const { posts, stats, relatedEvents, user, queueTypes, selectedQueueType } =
    useLoaderData();
  const params = useParams();
  const revalidator = useRevalidator();

  const [sortConfig, setSortConfig] = useState({
    key: "totalEngagement",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  });

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "postedAt") {
      const dateA = new Date(a[sortConfig.key]).getTime();
      const dateB = new Date(b[sortConfig.key]).getTime();
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }
    if (sortConfig.key === "totalEngagement") {
      return sortConfig.direction === "asc"
        ? a.totalEngagement - b.totalEngagement
        : b.totalEngagement - a.totalEngagement;
    }
    if (a[sortConfig.key] < b[sortConfig.key])
      return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key])
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const filteredPosts = sortedPosts.filter((post) => {
    // Text search filter
    const matchesSearch = post.caption
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    // Date range filter
    let matchesDateRange = true;
    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      const postDate = new Date(post.postedAt);
      if (postDate < fromDate) {
        matchesDateRange = false;
      }
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const postDate = new Date(post.postedAt);
      if (postDate > toDate) {
        matchesDateRange = false;
      }
    }

    return matchesSearch && matchesDateRange;
  });

  const requestSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div>
      <GiveawayRandomizer relatedEvents={relatedEvents} />

      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Top posts</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Date range filters */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2">
              <label htmlFor="from-date" className="whitespace-nowrap text-sm">
                From:
              </label>
              <input
                type="date"
                id="from-date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, from: e.target.value }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="to-date" className="whitespace-nowrap text-sm">
                To:
              </label>
              <input
                type="date"
                id="to-date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, to: e.target.value }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>

          {/* Search input */}
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
      </div>

      {/* Queue Selection Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
          <Link
            to="/dashboard/giveaway"
            prefetch="intent"
            onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${!params.queueType
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            All Queues
          </Link>
          {queueTypes.map((queueType) => {
            const queueName =
              typeof queueType === "string" ? queueType : queueType.name;
            const queueColor =
              typeof queueType === "object" ? queueType.color : null;
            const colors = getQueueColor(queueName, queueColor);
            const isSelected = params.queueType === queueName;

            const baseClasses =
              "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
            const unselectedClasses =
              "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

            if (isSelected && queueColor) {
              // Use inline styles for custom colors
              return (
                <Link
                  key={queueType.id}
                  to={`/dashboard/giveaway/${queueName}`}
                  prefetch="intent"
                  onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                  className={`${baseClasses} border-b-2`}
                  style={{
                    borderBottomColor: queueColor,
                    color: queueColor,
                  }}
                >
                  {queueName}
                </Link>
              );
            }

            return (
              <Link
                key={queueType.id}
                to={`/dashboard/giveaway/${queueName}`}
                prefetch="intent"
                onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                className={`${baseClasses} ${isSelected
                  ? `border-blue-500 ${colors.text}`
                  : unselectedClasses
                  }`}
              >
                {queueName}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Clear filters button */}
      {dateRange.from || dateRange.to || searchTerm ? (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => {
              setDateRange({ from: "", to: "" });
              setSearchTerm("");
            }}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {/* Results count */}
      <div className="mb-2 text-sm text-gray-500">
        Showing {filteredPosts.length} posts with engagement
      </div>

      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full whitespace-nowrap align-middle text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Media
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("caption")}
              >
                Caption{" "}
                {sortConfig.key === "caption"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("postedAt")}
              >
                Posted At{" "}
                {sortConfig.key === "postedAt"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("totalEngagement")}
              >
                Total Engagement{" "}
                {sortConfig.key === "totalEngagement"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Likes
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Replies
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Mentions
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Reposts
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Zaps
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Zapped
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("queueType")}
              >
                Queue{" "}
                {sortConfig.key === "queueType"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPosts.map((post) => (
              <tr
                key={post.id}
                className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
                onClick={() => setSelectedPost(post)}
              >
                <td className="p-3">
                  {post.fileUrl && post.fileUrl.length > 0 ? (
                    <div className="relative">
                      <MediaThumbnail
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Post preview"
                        className="h-12 w-12 rounded object-cover"
                        fallback={
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            TEXT
                          </div>
                        }
                      />
                      {post.repost ? (
                        <div className="absolute -right-1 -top-1 rounded-full bg-purple-500 p-1">
                          <svg
                            className="h-3 w-3 text-white"
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
                        </div>
                      ) : null}
                      {post.isQuotedPost ? (
                        <div className="absolute -right-1 -top-1 rounded-full bg-green-500 p-1">
                          <svg
                            className="h-3 w-3 text-white"
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
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        TEXT
                      </div>
                      {post.repost ? (
                        <div className="absolute -right-1 -top-1 rounded-full bg-purple-500 p-1">
                          <svg
                            className="h-3 w-3 text-white"
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
                        </div>
                      ) : null}
                      {post.isQuotedPost ? (
                        <div className="absolute -right-1 -top-1 rounded-full bg-green-500 p-1">
                          <svg
                            className="h-3 w-3 text-white"
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
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium">
                    {post.caption && post.caption.length > 10
                      ? post.caption.substring(0, 10) + "..."
                      : post.caption}
                  </p>
                </td>
                <td className="p-3">{formatDate(post.postedAt)}</td>
                <td className="p-3 font-bold">{post.totalEngagement}</td>
                <td className="p-3">{post.stats.likes}</td>
                <td className="p-3">{post.stats.replies}</td>
                <td className="p-3">{post.stats.mentions}</td>
                <td className="p-3">{post.stats.reposts}</td>
                <td className="p-3">{post.stats.zaps}</td>
                <td className="p-3">{post.stats.satszapped}</td>
                <td className="p-3">
                  {post.queueType?.color ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize"
                      style={{
                        backgroundColor: `${post.queueType.color}20`,
                        color: post.queueType.color,
                      }}
                    >
                      {post.queueType?.name || "unassigned"}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${getQueueColor(post.queueType?.name || "unassigned").bg} ${getQueueColor(post.queueType?.name || "unassigned").text}`}
                    >
                      {post.queueType?.name || "unassigned"}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <Link
                    to={`https://primal.net/e/${post.signedEvent.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-montserrat inline-block rounded-full bg-black/50 px-6 py-2 text-white transition-colors duration-200 hover:bg-black/70"
                  >
                    View Note
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          stats={selectedPost.stats}
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
