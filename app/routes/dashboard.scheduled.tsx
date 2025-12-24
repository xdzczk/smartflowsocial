import { json } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  Link,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useState, useEffect } from "react";

import MediaModal from "~/components/ui/MediaModal";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  requireUserId
} from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import AllContentListing from "~/features/posts/components/AllContentListing";
import { EditPostModal } from "~/features/posts/components/EditPostModal";
import LongFormDetailsModal from "~/features/posts/components/LongFormDetailsModal";
import LongFormListing from "~/features/posts/components/LongFormListing";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import PostTypeTabs from "~/features/posts/components/PostTypeTabs";
import QueueSelectionTabs from "~/features/posts/components/QueueSelectionTabs";
import { SimpleRescheduleModal } from "~/features/posts/components/SimpleRescheduleModal";
import { getQueueColor } from "~/features/posts/queueColors";

import {
  getScheduledDashboardData,
  handleScheduledPostAction
} from "~/features/posts/posts.server";

export async function loader({ request, params }) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to scheduled posts feature
  await requireFeatureAccess(userId, 'scheduled');

  const queueType = params.queueType || "all";

  const data = await getScheduledDashboardData({ userId, queueType });

  return json(data);
}

export async function action({ request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  return handleScheduledPostAction(formData, userId);
}

export default function ScheduledPosts() {
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType,
    hashTagPresets,
  } = useLoaderData();
  const params = useParams();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";

  const [sortConfig, setSortConfig] = useState({
    key: "scheduledFor",
    direction: "asc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [countdowns, setCountdowns] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [selectedLongFormPost, setSelectedLongFormPost] = useState(null);

  // Modal states for editing and rescheduling
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null);
  const [postToReschedule, setPostToReschedule] = useState(null);
  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();

  useEffect(() => {
    const updateCountdowns = () => {
      // Get current time in user's timezone
      const userTimezone = user?.timezone || "UTC";
      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: userTimezone }),
      ).getTime();
      const newCountdowns = {};

      posts.forEach((post) => {
        // Convert scheduled time from UTC to user's timezone
        const utcTime = parseInt(post.scheduledFor) * 1000;
        const userTime = new Date(utcTime).toLocaleString("en-US", {
          timeZone: userTimezone,
        });
        const scheduledTime = new Date(userTime).getTime();

        const distance = scheduledTime - now;

        if (distance > 0) {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
          const minutes = Math.floor(
            (distance % (1000 * 60 * 60)) / (1000 * 60),
          );

          newCountdowns[post.id] = `${days}d ${hours}h ${minutes}m`;
        } else {
          newCountdowns[post.id] = "Due now";
        }
      });

      setCountdowns(newCountdowns);
    };

    // Update immediately on mount
    updateCountdowns();

    const timer = setInterval(updateCountdowns, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [posts, user?.timezone]);

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "scheduledFor") {
      const dateA = parseInt(a[sortConfig.key]) * 1000; // Convert Unix timestamp to milliseconds
      const dateB = parseInt(b[sortConfig.key]) * 1000;
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
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

  const formatDate = (unixTimestamp) => {
    const userTimezone = user?.timezone || "UTC";
    const date = new Date(parseInt(unixTimestamp) * 1000);

    return date.toLocaleString("en-US", {
      timeZone: userTimezone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getImageUrls = (fileUrl) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    // Handle case where fileUrl is an array of JSON strings
    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]);
      } catch (e) {
        console.error("Error parsing fileUrl:", e);
        return [];
      }
    }

    // Handle direct URLs
    return fileUrl;
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

    // For All tab, we need to handle mixed content types
    if (currentTab === "all") {
      const selectedItems = allContent
        .filter((item) => selectedPosts.has(item.id))
        .map((item) => ({ id: item.id, type: item.type }));

      const formData = new FormData();
      formData.append("_action", "bulkDeleteMixed");
      formData.append("itemData", JSON.stringify(selectedItems));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    } else {
      // For individual tabs, use the original handlers
      const formData = new FormData();
      formData.append(
        "_action",
        currentTab === "longform" ? "bulkDeleteLongForm" : "bulkDelete",
      );
      formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

      bulkDeleteFetcher.submit(formData, { method: "post" });
    }
  };

  const handleMediaClick = (mediaSrc) => {
    setSelectedMedia(mediaSrc);
    setIsMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setSelectedMedia(null);
  };

  const handleEditPost = (post) => {
    setPostToEdit(post);
    setShowEditModal(true);
  };

  const handleReschedulePost = (post) => {
    setPostToReschedule(post);
    setShowRescheduleModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setPostToEdit(null);
  };

  const handleCloseRescheduleModal = () => {
    setShowRescheduleModal(false);
    setPostToReschedule(null);
  };

  const handleModalSuccess = () => {
    // Refresh the page data
    window.location.reload();
  };

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success) {
      setSelectedPosts(new Set());
    }
  }, [bulkDeleteFetcher.data]);

  return (
    <div>
      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Scheduled Posts</h3>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You have{" "}
            <span className="text-blue-600 dark:text-blue-400">
              {currentTab === "all"
                ? allContent.length
                : currentTab === "posts"
                  ? filteredPosts.length
                  : longformPosts.length}{" "}
              scheduled{" "}
              {currentTab === "all"
                ? "items"
                : currentTab === "posts"
                  ? "posts"
                  : "longform articles"}
            </span>
          </h4>
        </div>
      </div>

      {/* Post Type Tabs */}
      <PostTypeTabs
        currentTab={currentTab}
        allContent={allContent}
        posts={filteredPosts}
        longformPosts={longformPosts}
        basePath="/dashboard/scheduled"
      />

      {/* Queue Selection Tabs - Show for all content types */}
      {currentTab === "all" ||
        currentTab === "posts" ||
        currentTab === "longform" ? (
        <QueueSelectionTabs
          currentTab={currentTab}
          queueTypes={queueTypes}
          basePath="/dashboard"
        />
      ) : null}

      {/* Content based on current tab */}
      {currentTab === "all" ? (
        <AllContentListing
          content={allContent}
          type="scheduled"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone}
          onPostSelect={(content) => {
            // Handle selection based on content type
            if (content.type === "post") {
              setSelectedPost(content.originalData);
            } else {
              setSelectedLongFormPost(content.originalData);
            }
          }}
          selectedItems={selectedPosts}
          onToggleSelection={togglePostSelection}
          onToggleSelectAll={toggleSelectAll}
          showBulkActions={true}
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={bulkDeleteFetcher.state}
          onEditPost={handleEditPost}
          onReschedulePost={handleReschedulePost}
        />
      ) : currentTab === "posts" ? (
        <div>
          {/* Search Bar for Posts */}
          <div className="mb-4 flex items-center gap-2">
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

          {selectedPosts.size > 0 ? (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {selectedPosts.size} post{selectedPosts.size !== 1 ? "s" : ""}{" "}
                selected
              </span>
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
                    onClick={() => requestSort("scheduledFor")}
                  >
                    Scheduled For{" "}
                    {sortConfig.key === "scheduledFor"
                      ? sortConfig.direction === "asc"
                        ? "↑"
                        : "↓"
                      : null}
                  </th>
                  <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                    Time Remaining
                  </th>
                  <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                    Queue
                  </th>
                  <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                    Status
                  </th>
                  <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPosts.map((post) => {
                  // Get image URLs once to avoid multiple calls
                  const imageUrls =
                    post.fileUrl && post.fileUrl.length > 0
                      ? getImageUrls(post.fileUrl)
                      : [];
                  const firstImageUrl =
                    imageUrls.length > 0 ? imageUrls[0] : null;

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
                        <div className="relative">
                          {firstImageUrl ? (
                            <MediaThumbnail
                              src={firstImageUrl}
                              alt="Post preview"
                              className="h-12 w-12 rounded object-cover"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMediaClick(firstImageUrl);
                              }}
                              fallback={
                                <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                  TEXT
                                </div>
                              }
                            />
                          ) : post.repost ? (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-purple-100 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                              REPOST
                            </div>
                          ) : post.isQuotedPost ? (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-green-100 text-xs font-medium text-green-800 dark:bg-green-800 dark:text-green-200">
                              QUOTE
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              TEXT
                            </div>
                          )}
                          {post.repost && firstImageUrl ? (
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
                          {post.isQuotedPost && firstImageUrl ? (
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
                      </td>
                      <td className="p-3">
                        <p className="font-medium">
                          {post.caption?.length > 21
                            ? post.caption.substring(0, 21) + "..."
                            : post.caption}
                        </p>
                      </td>
                      <td className="p-3">{formatDate(post.scheduledFor)}</td>
                      <td className="p-3 text-center">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {countdowns[post.id]}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {post.queueType?.color ? (
                          <div
                            className="inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm"
                            style={{
                              backgroundColor: `${post.queueType.color}20`,
                              color: post.queueType.color,
                              borderColor: post.queueType.color,
                            }}
                          >
                            {post.queueType?.name || "unassigned"}
                          </div>
                        ) : (
                          <div
                            className={`inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 ${getQueueColor(post.queueType?.name || "unassigned").bg} ${getQueueColor(post.queueType?.name || "unassigned").text} ${getQueueColor(post.queueType?.name || "unassigned").border} shadow-sm`}
                          >
                            {post.queueType?.name || "unassigned"}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div
                          className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs font-semibold leading-4 ${post.isPostSigned
                            ? "bg-blue-100 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200"
                            : "bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-700/10 dark:text-emerald-200"
                            }`}
                        >
                          {post.isPostSigned ? "Signed" : "Scheduled"}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPost(post);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReschedulePost(post);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                          >
                            Reschedule
                          </button>
                          <deleteFetcher.Form
                            method="post"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="hidden"
                              name="postId"
                              value={post.id}
                            />
                            <input
                              type="hidden"
                              name="_action"
                              value="delete"
                            />
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

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
              showSignedEvent={true}
              type="scheduled"
              userTimezone={user?.timezone}
            />
          ) : null}

          {/* Media Modal */}
          {selectedMedia ? (
            <MediaModal
              src={selectedMedia}
              alt="Post media"
              isOpen={isMediaModalOpen}
              onClose={handleCloseMediaModal}
            />
          ) : null}
        </div>
      ) : (
        /* Longform Posts Content */
        <LongFormListing
          posts={longformPosts}
          type="scheduled"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post);
          }}
          onEditPost={handleEditPost}
          onReschedulePost={handleReschedulePost}
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="scheduled"
          showSignedEvent={true}
          userTimezone={user?.timezone}
        />
      ) : null}

      {/* Edit Post Modal */}
      {showEditModal && postToEdit ? (
        <EditPostModal
          post={postToEdit}
          onClose={handleCloseEditModal}
          onConfirm={handleModalSuccess}
          user={user}
          queueTypes={queueTypes}
          hashTagPresets={hashTagPresets}
        />
      ) : null}

      {/* Reschedule Post Modal */}
      {showRescheduleModal && postToReschedule ? (
        <SimpleRescheduleModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onConfirm={handleModalSuccess}
          user={user}
          queueTypes={queueTypes}
        />
      ) : null}
    </div>
  );
}
