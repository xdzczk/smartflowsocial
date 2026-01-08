import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

import type { PostData } from "../types";
interface ScheduledPostsLoaderData {
  scheduledPosts: PostData[];
}

export default function ScheduledPosts() {
  const { scheduledPosts } = useLoaderData<ScheduledPostsLoaderData>();
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);

  return (
    <>
      <div>
        {/* Tables: With Heading and Search */}
        <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <h3 className="mb-1 font-semibold">Scheduled Posts</h3>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              You have{" "}
              <span className="text-blue-600 dark:text-blue-400">
                {scheduledPosts.length} scheduled posts
              </span>
            </h4>
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
                className="block w-full rounded-lg border border-gray-200 py-2 pr-3 pl-10 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                placeholder="Search posts.."
              />
            </div>
          </div>
        </div>
        {/* Responsive Table Container */}
        <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* Table */}
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            {/* Table Header */}
            <thead>
              <tr>
                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Media
                </th>
                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Caption
                </th>
                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Type
                </th>
                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Scheduled For
                </th>
                <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Status
                </th>
                <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            {/* END Table Header */}

            {/* Table Body */}
            <tbody>
              {scheduledPosts.length > 0 ? (
                scheduledPosts.map((post) => {
                  // Safely parse the fileUrl and get the first image if it exists
                  let firstImage: string | undefined;
                  if (post.fileUrl.length > 0) {
                    try {
                      const firstFileUrl = post.fileUrl[0];
                      if (!firstFileUrl) return;
                      const parsed = JSON.parse(firstFileUrl) as string[];
                      firstImage = parsed[0];
                    } catch (_error) {
                      firstImage = post.fileUrl[0];
                    }
                  }

                  return (
                    <tr
                      key={post.id}
                      className="even:bg-gray-50 dark:even:bg-gray-900/50"
                    >
                      <td className="p-3">
                        <div className="size-12 overflow-hidden rounded-lg">
                          {firstImage ? (
                            <img
                              src={firstImage}
                              alt={post.caption ?? "Post media"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-700">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Text
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">
                          {post.caption ?? "No caption"}
                        </p>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400">
                        {post.postType}
                      </td>
                      <td className="p-3">
                        {new Date(
                          Number(post.scheduledFor) * 1000
                        ).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <div
                          className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${
                            post.signedEvent
                              ? "bg-blue-100 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200"
                              : "bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-700/10 dark:text-emerald-200"
                          }`}
                        >
                          {post.signedEvent ? "Signed" : "Scheduled"}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPost(post as unknown as PostData)
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-sm focus:ring focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No scheduled posts found
                  </td>
                </tr>
              )}
            </tbody>
            {/* END Table Body */}
          </table>
          {/* END Table */}
        </div>
        {/* END Responsive Table Container */}

        {/* Post Details Modal */}
        {selectedPost ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Post Details</h3>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="size-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                {(() => {
                  let modalImage: string | undefined;
                  if (selectedPost.fileUrl.length > 0) {
                    try {
                      const firstFileUrl = selectedPost.fileUrl[0];
                      if (!firstFileUrl) return;
                      const parsed = JSON.parse(firstFileUrl) as string[];
                      modalImage = parsed[0];
                    } catch (_error) {
                      modalImage = selectedPost.fileUrl[0];
                    }
                  }
                  return modalImage ? (
                    <img
                      src={modalImage}
                      alt={selectedPost.caption ?? "Post media"}
                      className="mx-auto max-h-96 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="mx-auto flex h-48 w-full max-w-md items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                      <span className="text-gray-500 dark:text-gray-400">
                        Text post
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Caption:</span>
                  <p className="mt-1">{selectedPost.caption ?? "No caption"}</p>
                </div>
                <div>
                  <span className="font-semibold">Type:</span>
                  <p className="mt-1">{selectedPost.postType}</p>
                </div>
                <div>
                  <span className="font-semibold">Scheduled For:</span>
                  <p className="mt-1">
                    {new Date(
                      Number(selectedPost.scheduledFor) * 1000
                    ).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Status:</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${
                        selectedPost.signedEvent
                          ? "bg-blue-100 text-blue-900 dark:border-blue-900/75 dark:bg-blue-700/10 dark:text-blue-200"
                          : "bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-700/10 dark:text-emerald-200"
                      }`}
                    >
                      {selectedPost.signedEvent ? "Signed" : "Scheduled"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* END Tables: With Heading and Search */}
      </div>
    </>
  );
}
