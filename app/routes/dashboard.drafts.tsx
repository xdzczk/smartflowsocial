import { json } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  Link,
  useParams,
  useRevalidator,
  Outlet,
  useSearchParams,
} from "@remix-run/react";
import { useState, useEffect } from "react";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import { combineContent } from "~/features/posts/combined.server";
import AllContentListing from "~/features/posts/components/AllContentListing";
import DraftBulkResume from "~/features/posts/components/DraftBulkResume";
import LongFormListing from "~/features/posts/components/LongFormListing";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { getQueueColor } from "~/features/posts/queueColors";
import {
  getDraftLongFormPosts,
  deleteLongFormPost,
} from "~/models/longformpost.server";
import { getDraftPosts, deletePost, updatePost } from "~/models/post.server";
import { getUserById, getQueueTypes } from "~/models/user.server";

export async function loader({ request, params }) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to the drafts feature
  await requireFeatureAccess(userId, 'drafts');

  const queueType = params.queueType || "all";

  const [posts, allLongformPosts, user, queueTypes] = await Promise.all([
    getDraftPosts({ userId, queueType }),
    getDraftLongFormPosts({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter longform posts by queue type if specific queue is selected
  const longformPosts =
    queueType === "all"
      ? allLongformPosts
      : allLongformPosts.filter((post) => post.queueType?.name === queueType);

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(posts, longformPosts, "createdAt", "desc");

  return json({
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
  });
}

export async function action({ request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const postId = formData.get("postId");
  const _action = formData.get("_action");

  if (_action === "delete") {
    await deletePost({ id: postId, userId });
    return json({ success: true });
  }

  if (_action === "deleteLongForm") {
    await deleteLongFormPost({ id: postId, userId });
    return json({ success: true });
  }

  if (_action === "bulkDelete") {
    const postIds = JSON.parse(formData.get("postIds"));
    await Promise.all(postIds.map((id) => deletePost({ id, userId })));
    return json({ success: true });
  }

  if (_action === "bulkDeleteLongForm") {
    const postIds = JSON.parse(formData.get("postIds"));
    await Promise.all(postIds.map((id) => deleteLongFormPost({ id, userId })));
    return json({ success: true });
  }

  // Removed bulkResume - all resume operations must be signed

  if (_action === "bulkSignAndResume") {
    const postIds = formData.getAll("postIds");
    const contents = formData.getAll("contents");
    const captions = formData.getAll("captions");
    const queueTypes = formData.getAll("queueTypes");
    const scheduledFors = formData.getAll("scheduledFors");
    const signedEvents = formData.getAll("signedEvents");
    const nostrEvents = formData.getAll("nostrEvents");

    await Promise.all(
      postIds.map((id, index) =>
        updatePost({
          id,
          userId,
          data: {
            content: contents[index],
            caption: captions[index],
            queueType: queueTypes[index],
            scheduledFor: scheduledFors[index],
            signedEvent: JSON.parse(signedEvents[index]),
            nostrEvent: JSON.parse(nostrEvents[index]),
            draft: false,
            isScheduled: true,
            isPosted: false,
          },
        }),
      ),
    );
    return json({ success: true });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function DraftPosts() {
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType,
  } = useLoaderData();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Check if we're on a child route (like edit)
  const isChildRoute = params.id;

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";
  const revalidator = useRevalidator();

  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [showAdvancedBulkResume, setShowAdvancedBulkResume] = useState(false);
  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const bulkResumeFetcher = useFetcher();

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortConfig.key === "createdAt") {
      const dateA = new Date(a[sortConfig.key]).getTime();
      const dateB = new Date(b[sortConfig.key]).getTime();
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

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
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

    const formData = new FormData();
    formData.append("_action", "bulkDelete");
    formData.append("postIds", JSON.stringify(Array.from(selectedPosts)));

    bulkDeleteFetcher.submit(formData, { method: "post" });
  };

  useEffect(() => {
    if (bulkDeleteFetcher.data?.success || bulkResumeFetcher.data?.success) {
      setSelectedPosts(new Set());
      setShowAdvancedBulkResume(false);
    }
  }, [bulkDeleteFetcher.data, bulkResumeFetcher.data]);

  // If we're on a child route, render the child component
  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <div>
      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Draft Posts</h3>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You have{" "}
            <span className="text-blue-600 dark:text-blue-400">
              {currentTab === "all"
                ? allContent.length
                : currentTab === "posts"
                  ? filteredPosts.length
                  : longformPosts.length}{" "}
              draft{" "}
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
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Post Types">
          <Link
            to={`/dashboard/drafts${params.queueType ? `/${params.queueType}` : ""}?tab=all`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "all"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            All ({allContent.length})
          </Link>
          <Link
            to={`/dashboard/drafts${params.queueType ? `/${params.queueType}` : ""}?tab=posts`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "posts"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            Posts ({filteredPosts.length})
          </Link>
          <Link
            to={`/dashboard/drafts${params.queueType ? `/${params.queueType}` : ""}?tab=longform`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "longform"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            Longform ({longformPosts.length})
          </Link>
        </nav>
      </div>

      {/* Queue Selection Tabs - Show for all content types */}
      {currentTab === "all" ||
        currentTab === "posts" ||
        currentTab === "longform" ? (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
            <Link
              to={`/dashboard/drafts?tab=${currentTab}`}
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
                    to={`/dashboard/drafts/${queueName}?tab=${currentTab}`}
                    prefetch="intent"
                    onClick={() =>
                      setTimeout(() => revalidator.revalidate(), 0)
                    }
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
                  to={`/dashboard/drafts/${queueName}?tab=${currentTab}`}
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
      ) : null}

      {/* Content based on current tab */}
      {currentTab === "all" ? (
        <AllContentListing
          content={allContent}
          type="draft"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone}
          onPostSelect={(content) => {
            // Handle selection based on content type
            if (content.type === "post") {
              setSelectedPost(content.originalData);
            }
            // For longform, could add modal handling similar to posts
          }}
          selectedItems={selectedPosts}
          onToggleSelection={togglePostSelection}
          onToggleSelectAll={toggleSelectAll}
          showBulkActions={true}
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={bulkDeleteFetcher.state}
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
                placeholder="Search drafts..."
              />
            </div>
          </div>

          {selectedPosts.size > 0 ? (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {selectedPosts.size} post{selectedPosts.size !== 1 ? "s" : ""}{" "}
                selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdvancedBulkResume(true)}
                  disabled={bulkResumeFetcher.state !== "idle"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                >
                  Bulk Edit
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
                    onClick={() => requestSort("createdAt")}
                  >
                    Created{" "}
                    {sortConfig.key === "createdAt"
                      ? sortConfig.direction === "asc"
                        ? "↑"
                        : "↓"
                      : null}
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
                {filteredPosts.map((post) => (
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
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          TEXT
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{post.caption}</p>
                    </td>
                    <td className="p-3">{formatDate(post.createdAt)}</td>
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
                      <div className="inline-flex rounded-full border border-transparent bg-orange-100 px-2 py-1 text-xs font-semibold leading-4 text-orange-900 dark:border-orange-900/75 dark:bg-orange-700/10 dark:text-orange-200">
                        Draft
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <Link
                          to={`/dashboard/drafts/edit/${post.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
                        >
                          Edit
                        </Link>
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
                ))}
              </tbody>
            </table>
          </div>

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
              type="draft"
              userTimezone={user?.timezone}
            />
          ) : null}

          {/* Bulk Edit */}
          {showAdvancedBulkResume ? (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
              <DraftBulkResume
                selectedDrafts={filteredPosts.filter((post) =>
                  selectedPosts.has(post.id),
                )}
                queueTypes={queueTypes}
                onCancel={() => setShowAdvancedBulkResume(false)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        /* Longform Posts Content */
        <LongFormListing
          posts={longformPosts}
          type="draft"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone}
          onPostSelect={(_post) => {
            // TODO: Add longform post detail modal here if needed
          }}
        />
      )}
    </div>
  );
}
