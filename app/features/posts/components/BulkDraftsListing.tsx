import { Link } from "@remix-run/react";

interface BulkDraftGroupItem {
  id: string;
  postCount: number;
  updatedAt: string;
}

interface BulkDraftsListingProps {
  groups: BulkDraftGroupItem[];
}

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "Unknown";
  }
}

export function BulkDraftsListing({ groups }: BulkDraftsListingProps) {
  if (groups.length === 0) {
    return (
      <div className="text-text-secondary p-6 text-center">
        <p className="mb-3">No bulk drafts.</p>
        <p className="mb-4">
          Save a batch of posts as a draft from{" "}
          <Link
            to="/dashboard/bulkposts"
            className="text-brand font-medium hover:underline"
          >
            Bulk Posts
          </Link>{" "}
          to see them here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {groups.map((g) => (
        <li key={g.id}>
          <Link
            to={`/dashboard/bulkposts?groupId=${encodeURIComponent(g.id)}`}
            className="hover:bg-surface-hover/50 flex items-center justify-between gap-4 px-4 py-3 transition-colors"
          >
            <span className="font-medium">
              {g.postCount} {g.postCount === 1 ? "post" : "posts"}
            </span>
            <span className="text-text-secondary text-sm">
              Last saved {formatUpdatedAt(g.updatedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
