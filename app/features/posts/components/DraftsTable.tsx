/**
 * Drafts table component
 */

import { Link, useFetcher } from "@remix-run/react";

import { formatForDisplay, fromISOString } from "~/lib/temporal";

import { getQueueColor } from "../queue-colors";
interface Post {
  id: string;
  caption?: string | null;
  createdAt: string;
  fileUrl?: string[] | null;
  queueType?: { name: string; color?: string | null } | null;
}

interface DraftsTableProps {
  posts: Post[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  selectedPosts: Set<string>;
  onToggleSelection: (postId: string) => void;
  onToggleSelectAll: () => void;
  onPostClick: (post: Post) => void;
  bulkDeleteState: string;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
}

interface SortableHeaderProps {
  sortKey: string;
  label: string;
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
}

const SortableHeader = ({
  sortKey,
  label,
  sortConfig,
  onRequestSort,
}: SortableHeaderProps) => (
  <th
    className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
    onClick={() => onRequestSort(sortKey)}
  >
    {label}{" "}
    {sortConfig.key === sortKey
      ? sortConfig.direction === "asc"
        ? "↑"
        : "↓"
      : null}
  </th>
);

export function DraftsTable({
  posts,
  sortConfig,
  onRequestSort,
  selectedPosts,
  onToggleSelection,
  onToggleSelectAll,
  onPostClick,
  bulkDeleteState,
  userTimezone = "UTC",
  userTimeFormat = "12h",
}: DraftsTableProps) {
  const deleteFetcher = useFetcher();

  const formatDate = (isoString: string) => {
    try {
      const zoned = fromISOString(isoString, "UTC");
      const userZoned = zoned.withTimeZone(userTimezone);
      return formatForDisplay(
        userZoned,
        userTimezone,
        {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
        userTimeFormat
      );
    } catch {
      // Fallback - still use Temporal for consistency
      try {
        const zoned = fromISOString(isoString, "UTC");
        const userZoned = zoned.withTimeZone(userTimezone);
        return formatForDisplay(
          userZoned,
          userTimezone,
          {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          },
          userTimeFormat
        );
      } catch {
        // Final fallback
        const date = new Date(isoString);
        return date.toLocaleString("en-US", {
          timeZone: userTimezone,
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: userTimeFormat === "12h",
        });
      }
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (_e) {
        return [];
      }
    }

    return fileUrl;
  };

  return (
    <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              <input
                id="draft-select-all"
                name="draft-select-all"
                type="checkbox"
                checked={
                  posts.length > 0 ? selectedPosts.size === posts.length : false
                }
                onChange={onToggleSelectAll}
                className="border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
              />
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
              Media
            </th>
            <SortableHeader
              sortKey="caption"
              label="Caption"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <SortableHeader
              sortKey="createdAt"
              label="Created"
              sortConfig={sortConfig}
              onRequestSort={onRequestSort}
            />
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Queue
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Status
            </th>
            <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="border-border dark:hover:bg-muted hover:bg-muted cursor-pointer border-b"
              onClick={() => onPostClick(post)}
            >
              <td className="p-3 text-center">
                <input
                  id={`draft-select-${post.id}`}
                  name={`draft-select-${post.id}`}
                  type="checkbox"
                  checked={selectedPosts.has(post.id)}
                  onChange={() => onToggleSelection(post.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
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
                  <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                    TEXT
                  </div>
                )}
              </td>
              <td className="p-3">
                <p className="font-medium">{post.caption ?? "—"}</p>
              </td>
              <td className="p-3">{formatDate(post.createdAt)}</td>
              <td className="p-3 text-center">
                {post.queueType?.color ? (
                  <div
                    className="inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold shadow-sm"
                    style={{
                      backgroundColor: `${post.queueType.color}20`,
                      color: post.queueType.color,
                      borderColor: post.queueType.color,
                    }}
                  >
                    {post.queueType.name || "unassigned"}
                  </div>
                ) : (
                  <div
                    className={`inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold ${(() => {
                      const colors = getQueueColor(
                        post.queueType?.name ?? "unassigned"
                      );
                      return colors
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : "";
                    })()} shadow-sm`}
                  >
                    {post.queueType?.name ?? "unassigned"}
                  </div>
                )}
              </td>
              <td className="p-3 text-center">
                <div className="bg-muted text-foreground inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
                  Draft
                </div>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center gap-2">
                  <Link
                    to={`/dashboard/drafts/edit/${post.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-primary/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
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
                        bulkDeleteState !== "idle"
                      }
                      className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-destructive/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
  );
}
