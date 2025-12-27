import { Link } from "@remix-run/react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getQueueColor } from "~/features/posts/queueColors";
import { formatDate, getImageUrls } from "~/lib/helpers";
interface Post {
  id: string;
  caption?: string | null;
  postedAt: Date | null;
  fileUrl: string[];
  signedEvent: { id: string };
  queueType?: { name: string; color?: string | null } | null;
  repost?: boolean;
  isQuotedPost?: boolean;
  totalEngagement: number;
  stats: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
}

interface GiveawayTableProps {
  posts: Post[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  onPostClick: (post: Post) => void;
}

/**
 * Table component for displaying giveaway posts
 */
export function GiveawayTable({
  posts,
  sortConfig,
  onRequestSort,
  onPostClick,
}: GiveawayTableProps) {
  const SortableHeader = ({
    key,
    label,
  }: {
    key: string;
    label: string;
  }) => (
    <th
      className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
      onClick={() => onRequestSort(key)}
    >
      {label}{" "}
      {sortConfig.key === key
        ? sortConfig.direction === "asc"
          ? "↑"
          : "↓"
        : null}
    </th>
  );

  return (
    <>
      {/* Results count */}
      <div className="mb-2 text-sm text-gray-500">
        Showing {posts.length} posts with engagement
      </div>

      <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full whitespace-nowrap align-middle text-sm">
          <thead>
            <tr>
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Media
              </th>
              <SortableHeader key="caption" label="Caption" />
              <SortableHeader key="postedAt" label="Posted At" />
              <SortableHeader key="totalEngagement" label="Total Engagement" />
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
              <SortableHeader key="queueType" label="Queue" />
              <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
                onClick={() => onPostClick(post)}
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
                <td className="p-3">{post.postedAt ? formatDate(post.postedAt) : "—"}</td>
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
                      {post.queueType?.name ?? "unassigned"}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${getQueueColor(post.queueType?.name ?? "unassigned").bg} ${getQueueColor(post.queueType?.name ?? "unassigned").text}`}
                    >
                      {post.queueType?.name ?? "unassigned"}
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
    </>
  );
}




