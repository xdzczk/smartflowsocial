import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useParams,
  useRevalidator,
  useFetcher,
} from "@remix-run/react";
import { useState, useEffect } from "react";

import {
  getRecyclableDashboardData,
  handleRecyclablePostAction
} from "~/features/posts/posts.server";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { getQueueColor } from "~/features/posts/queueColors";
import { formatDate, getImageUrls } from "~/lib/helpers";
import { signEventFn } from "~/lib/nostr";



export async function loader({ request, params }) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to recyclables feature
  await requireFeatureAccess(userId, "recyclables");

  const url = new URL(request.url);

  const data = await getRecyclableDashboardData({ userId, params, url });

  return json(data);
}

export async function action({ request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  return handleRecyclablePostAction(formData, userId);
}

export default function RecyclablesPosts() {
  const { posts, pagination, stats, user, queueTypes, selectedQueueType } =
    useLoaderData();
  const params = useParams();
  const revalidator = useRevalidator();

  const [sortConfig, setSortConfig] = useState({
    key: "postedAt",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [toast, setToast] = useState(null);
  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher();
  const individualRepostFetcher = useFetcher();

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "postedAt") {
      const dateA = new Date(a[sortConfig.key]).getTime();
      const dateB = new Date(b[sortConfig.key]).getTime();
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
      const aStats = stats[a.signedEvent.id] || {};
      const bStats = stats[b.signedEvent.id] || {};
      const aValue = aStats[sortConfig.key] || 0;
      const bValue = bStats[sortConfig.key] || 0;
      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    if (a[sortConfig.key] < b[sortConfig.key])
      return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key])
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const filteredPosts = sortedPosts.filter((post) =>
    post.caption?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const requestSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const togglePostSelection = (postId) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkDelete");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkDeleteFetcher.submit(formData, { method: "post" });
  };

  const handleBulkRepost = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkRepost");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    repostFetcher.submit(formData, { method: "post" });
  };

  const handleBulkScheduledRepost = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkScheduledRepost");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    repostFetcher.submit(formData, { method: "post" });
  };

  const handleBulkQuote = () => {
    if (selectedPosts.size === 0) return;

    const formData = new FormData();
    formData.append("_action", "bulkQuote");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    repostFetcher.submit(formData, { method: "post" });
  };

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  useEffect(() => {
    if (repostFetcher.data?.repostData) {
      const postsData = repostFetcher.data.repostData;

      // Prepare repost data with 1 hour default scheduling
      const now = new Date();
      const userTimezone = user?.timezone || "UTC";
      const localDate = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone }),
      );
      localDate.setHours(localDate.getHours() + 1);

      const repostData = postsData.map((post, index) => {
        const scheduleDate = new Date(localDate);
        scheduleDate.setHours(scheduleDate.getHours() + index);

        return {
          caption: post.caption || "",
          fileUrl:
            post.fileUrl &&
              Array.isArray(post.fileUrl) &&
              post.fileUrl.length > 0
              ? post.fileUrl[0]
              : "",
          queueType: post.queueType || "unassigned",
          scheduledFor: scheduleDate
            .toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
          originalPostId: post.id, // Include the original post ID for tracking
        };
      });

      // Store repost data in sessionStorage
      sessionStorage.setItem("repostData", JSON.stringify(repostData));

      // Navigate to bulk posts page
      window.location.href = "/dashboard/bulkposts?mode=recycle";

      // Clear selection
      setSelectedPosts(new Set());
    }

    if (repostFetcher.data?.scheduledRepostData) {
      const postsData = repostFetcher.data.scheduledRepostData;

      // Prepare scheduled repost data with 1 hour default scheduling
      const now = new Date();
      const userTimezone = user?.timezone || "UTC";
      const localDate = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone }),
      );
      localDate.setHours(localDate.getHours() + 1);

      const scheduledRepostData = postsData.map((post, index) => {
        const scheduleDate = new Date(localDate);
        scheduleDate.setHours(scheduleDate.getHours() + index);

        return {
          caption: "", // Empty content for kind 6 reposts
          fileUrl: "", // No file URL for kind 6 reposts
          queueType: post.queueType || "unassigned",
          scheduledFor: scheduleDate
            .toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
          originalPostId: post.id,
          originalEventId: post.signedEvent?.id,
          originalEventPubkey: post.signedEvent?.pubkey,
          isKind6Repost: true,
        };
      });

      // Store scheduled repost data in sessionStorage
      sessionStorage.setItem(
        "scheduledRepostData",
        JSON.stringify(scheduledRepostData),
      );

      // Navigate to bulk posts page with repost mode
      window.location.href = "/dashboard/bulkposts?mode=repost";

      // Clear selection
      setSelectedPosts(new Set());
    }

    if (repostFetcher.data?.quotePostData) {
      const quoteData = repostFetcher.data.quotePostData;

      // Store quote post data in sessionStorage
      sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));

      // Navigate to bulk posts page with quote mode
      window.location.href = "/dashboard/bulkposts?mode=quote";

      // Clear selection
      setSelectedPosts(new Set());
    }
  }, [repostFetcher.data, user?.timezone]);

  useEffect(() => {
    const handleRepost = async () => {
      if (individualRepostFetcher.data?.repostEventData) {
        try {
          const eventData = individualRepostFetcher.data.repostEventData;

          // Sign the event using client-side signing
          const { signedEvent } = await signEventFn(eventData);

          // Get user relays from user data
          const sanitizedRelays = user.relays || ["wss://relay.primal.net"];

          // Publish the signed event
          const response = await fetch("/api/publish", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              relays: sanitizedRelays,
              event: signedEvent,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to publish repost");
          }

          // Add delay before showing success toast
          setTimeout(() => {
            setToast({
              type: "success",
              message: "Post reposted successfully!",
              link: `https://primal.net/e/${eventData.tags.find((tag) => tag[0] === "e")?.[1]}`,
              linkText: "View Original Post",
            });

            // Hide toast after 8 seconds for success with link
            setTimeout(() => setToast(null), 8000);
          }, 1000); // 1 second delay
        } catch (error) {
          console.error("Repost signing/publishing error:", error);
          setToast({
            type: "error",
            message: error.message || "Failed to sign or publish repost",
          });

          // Hide toast after 5 seconds for errors
          setTimeout(() => setToast(null), 5000);
        }
      } else if (individualRepostFetcher.data?.quotePostData) {
        // Handle individual quote post - redirect to bulk posts with single item
        const quoteData = individualRepostFetcher.data.quotePostData;

        // Store quote post data in sessionStorage
        sessionStorage.setItem("quotePostData", JSON.stringify(quoteData));

        // Navigate to bulk posts page with quote mode
        window.location.href = "/dashboard/bulkposts?mode=quote";
      } else if (individualRepostFetcher.data?.error) {
        setToast({
          type: "error",
          message:
            individualRepostFetcher.data.message || "Failed to create repost",
        });

        // Hide toast after 5 seconds for errors
        setTimeout(() => setToast(null), 5000);
      }
    };

    if (individualRepostFetcher.data) {
      handleRepost();
    }
  }, [individualRepostFetcher.data]);

  return (
    <div>
      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Recyclable Posts</h3>
        </div>
        <div className="flex items-center gap-2">
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
            to="/dashboard/recyclables"
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
                  key={queueName}
                  to={`/dashboard/recyclables/${queueName}`}
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
                key={queueName}
                to={`/dashboard/recyclables/${queueName}`}
                prefetch="intent"
                onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                className={`${baseClasses} ${isSelected
                  ? `${colors.border.replace("border-", "border-b-")} ${colors.text}`
                  : unselectedClasses
                  }`}
              >
                {queueName}
              </Link>
            );
          })}
        </nav>
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

      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full whitespace-nowrap align-middle text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                <input
                  type="checkbox"
                  checked={
                    filteredPosts.length > 0
                      ? selectedPosts.size === filteredPosts.length
                      : null
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
              </th>
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
                onClick={() => requestSort("likes")}
              >
                Likes{" "}
                {sortConfig.key === "likes"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("replies")}
              >
                Replies{" "}
                {sortConfig.key === "replies"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("mentions")}
              >
                Mentions{" "}
                {sortConfig.key === "mentions"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("reposts")}
              >
                Reposts{" "}
                {sortConfig.key === "reposts"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("zaps")}
              >
                Zaps{" "}
                {sortConfig.key === "zaps"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("satszapped")}
              >
                Zapped{" "}
                {sortConfig.key === "satszapped"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
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
              <th
                className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
                onClick={() => requestSort("status")}
              >
                Status{" "}
                {sortConfig.key === "status"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : null}
              </th>
              <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPosts.map((post) => {
              const postStats = stats[post.signedEvent.id] || {
                likes: 0,
                replies: 0,
                mentions: 0,
                reposts: 0,
                zaps: 0,
                satszapped: 0,
              };
              return (
                <tr
                  key={post.id}
                  className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
                  onClick={() => setSelectedPost(post)}
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={() => togglePostSelection(post.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </td>
                  <td className="p-3">
                    {post.fileUrl && post.fileUrl.length > 0 ? (
                      <img
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Post preview"
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        TEXT
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">
                      {post.caption?.length > 21
                        ? post.caption.substring(0, 21) + "..."
                        : post.caption}
                    </p>
                  </td>
                  <td className="p-3">{formatDate(post.postedAt)}</td>
                  <td className="p-3">{postStats.likes}</td>
                  <td className="p-3">{postStats.replies}</td>
                  <td className="p-3">{postStats.mentions}</td>
                  <td className="p-3">{postStats.reposts}</td>
                  <td className="p-3">{postStats.zaps}</td>
                  <td className="p-3">{postStats.satszapped}</td>
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
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Recyclable
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`https://primal.net/e/${post.signedEvent.id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
                      >
                        View Note
                      </Link>
                      <individualRepostFetcher.Form
                        method="post"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="_action" value="repost" />
                        <button
                          type="submit"
                          disabled={
                            individualRepostFetcher.state !== "idle" ||
                            individualRepostFetcher.formData?.get("postId") ===
                            post.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                        >
                          {individualRepostFetcher.state !== "idle" &&
                            individualRepostFetcher.formData?.get("postId") ===
                            post.id
                            ? "Reposting..."
                            : "Repost"}
                        </button>
                      </individualRepostFetcher.Form>
                      <individualRepostFetcher.Form
                        method="post"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="_action" value="quote" />
                        <button
                          type="submit"
                          disabled={
                            individualRepostFetcher.state !== "idle" ||
                            individualRepostFetcher.formData?.get("postId") ===
                            post.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                        >
                          {individualRepostFetcher.state !== "idle" &&
                            individualRepostFetcher.formData?.get("postId") ===
                            post.id
                            ? "Quoting..."
                            : "Quote Post"}
                        </button>
                      </individualRepostFetcher.Form>
                      <deleteFetcher.Form
                        method="post"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="_action" value="delete" />
                        <button
                          type="submit"
                          disabled={
                            deleteFetcher.state !== "idle" ||
                            bulkDeleteFetcher.state !== "idle"
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
                        >
                          {deleteFetcher.state !== "idle" &&
                            deleteFetcher.formData?.get("postId") === post.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </deleteFetcher.Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
            to={`${params.queueType ? `/dashboard/recyclables/${params.queueType}` : "/dashboard/recyclables"}?page=${pagination.currentPage - 1}`}
            className={`rounded-lg border px-3 py-1 ${pagination.currentPage === 1
              ? "pointer-events-none opacity-50"
              : "hover:bg-gray-100"
              }`}
          >
            Previous
          </Link>
          <Link
            to={`${params.queueType ? `/dashboard/recyclables/${params.queueType}` : "/dashboard/recyclables"}?page=${pagination.currentPage + 1}`}
            className={`rounded-lg border px-3 py-1 ${pagination.currentPage === pagination.pages
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
          stats={stats[selectedPost.signedEvent.id]}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone}
        />
      ) : null}

      {/* Toast Notification */}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-4 py-3 text-white shadow-lg ${toast.type === "success" ? "bg-green-500" : "bg-red-500"
              }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{toast.message}</span>
                {toast.link ? (
                  <a
                    href={toast.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline hover:no-underline"
                  >
                    {toast.linkText}
                  </a>
                ) : null}
              </div>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-white/80 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
