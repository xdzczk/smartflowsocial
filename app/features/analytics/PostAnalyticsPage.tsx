import { Link } from "@remix-run/react";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "~/components/layout/PageHeader";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";

import type {
  AnalyticsCountView,
  AnalyticsNoteView,
  PostAnalyticsPageData,
} from "./load-post-analytics.server";

function kindLabel(kind: number): string {
  if (kind === 1) return "Note";
  if (kind === 30023) return "Article";
  return `Kind ${kind}`;
}

function CountGrid({
  status,
  counts,
}: {
  status: AnalyticsNoteView["status"];
  counts: AnalyticsCountView | null;
}) {
  if (status === "not_collected") {
    return <p className="text-muted text-sm">Not collected yet</p>;
  }
  if (status === "missing") {
    return <p className="text-muted text-sm">Not in the index</p>;
  }
  const value = counts ?? {
    reactions: 0,
    replies: 0,
    reposts: 0,
    zaps: 0,
    sats: 0,
  };
  const items = [
    ["Reactions", value.reactions],
    ["Replies", value.replies],
    ["Reposts", value.reposts],
    ["Zaps", value.zaps],
    ["Sats", value.sats],
  ] as const;
  return (
    <dl className="grid grid-cols-5 gap-2 text-sm">
      {items.map(([label, count]) => (
        <div key={label}>
          <dt className="text-muted text-xs">{label}</dt>
          <dd className="tabular-nums">{count}</dd>
        </div>
      ))}
    </dl>
  );
}

function NoteSummary({ note }: { note: AnalyticsNoteView }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted text-xs">{kindLabel(note.kind)}</span>
        {note.publishedInSmartFlow ? (
          <Badge variant="brand">SmartFlow</Badge>
        ) : null}
        {note.eventCreatedAt ? (
          <span className="text-muted text-xs">{note.eventCreatedAt}</span>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap">
        {note.contentExcerpt || "No text"}
      </p>
    </>
  );
}

function CountCells({
  status,
  counts,
}: {
  status: AnalyticsNoteView["status"];
  counts: AnalyticsCountView | null;
}) {
  if (status === "not_collected") {
    return (
      <td className="text-muted px-3 py-3" colSpan={5}>
        Not collected yet
      </td>
    );
  }
  if (status === "missing") {
    return (
      <td className="text-muted px-3 py-3" colSpan={5}>
        Not in the index
      </td>
    );
  }
  const value = counts ?? {
    reactions: 0,
    replies: 0,
    reposts: 0,
    zaps: 0,
    sats: 0,
  };
  return (
    <>
      <td className="px-3 py-3 tabular-nums">{value.reactions}</td>
      <td className="px-3 py-3 tabular-nums">{value.replies}</td>
      <td className="px-3 py-3 tabular-nums">{value.reposts}</td>
      <td className="px-3 py-3 tabular-nums">{value.zaps}</td>
      <td className="px-3 py-3 tabular-nums">{value.sats}</td>
    </>
  );
}

export function PostAnalyticsPage({ data }: { data: PostAnalyticsPageData }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <PageHeader
        variant="library"
        title="Post analytics"
        subtitle="Reactions, replies, reposts, zaps, and sats saved from NostrMash while a paid plan is active."
      />

      {data.collectionActive ? (
        <p className="text-muted text-sm">
          Collection is on. New notes NostrMash still lists for this profile are
          checked on the analytics sweep, including posts made outside
          SmartFlow.
        </p>
      ) : (
        <p className="text-muted text-sm" data-testid="collection-paused">
          Collection is paused. Saved history stays on this page. Checks resume
          when a paid plan is active.
        </p>
      )}

      {data.notes.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title={
            data.collectionActive ? "Nothing indexed yet" : "No saved analytics"
          }
          description={
            data.collectionActive
              ? "The next sweep will list notes and articles NostrMash still has for this profile."
              : "A paid plan collects this history. This account has no saved checks."
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {data.notes.map((note) => (
              <article
                key={note.nostrEventId}
                className="border-border flex flex-col gap-3 rounded-lg border p-3"
                data-testid={`analytics-note-${note.status}`}
              >
                <NoteSummary note={note} />
                <CountGrid status={note.status} counts={note.counts} />
                <Link
                  className="text-link text-xs"
                  to={`/dashboard/post-analytics?event=${note.nostrEventId}`}
                  prefetch="intent"
                >
                  History
                </Link>
              </article>
            ))}
          </div>
          <div className="border-border hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-hover text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Post</th>
                  <th className="px-3 py-2 font-medium">Reactions</th>
                  <th className="px-3 py-2 font-medium">Replies</th>
                  <th className="px-3 py-2 font-medium">Reposts</th>
                  <th className="px-3 py-2 font-medium">Zaps</th>
                  <th className="px-3 py-2 font-medium">Sats</th>
                </tr>
              </thead>
              <tbody>
                {data.notes.map((note) => (
                  <tr
                    key={note.nostrEventId}
                    className="border-border border-t align-top"
                    data-testid={`analytics-note-${note.status}`}
                  >
                    <td className="px-3 py-3">
                      <NoteSummary note={note} />
                      <Link
                        className="text-link mt-1 inline-block text-xs"
                        to={`/dashboard/post-analytics?event=${note.nostrEventId}`}
                        prefetch="intent"
                      >
                        History
                      </Link>
                    </td>
                    <CountCells status={note.status} counts={note.counts} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.history ? (
        <section
          className="flex flex-col gap-3"
          data-testid="analytics-history"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-h3">Stored history</h2>
            <Link className="text-link text-sm" to="/dashboard/post-analytics">
              Close
            </Link>
          </div>
          <p className="text-muted max-w-2xl text-sm">
            {data.history.contentExcerpt || "No text"}
          </p>
          {data.history.points.length === 0 ? (
            <p className="text-sm">Not collected yet</p>
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface-hover text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Checked</th>
                    <th className="px-3 py-2 font-medium">Reactions</th>
                    <th className="px-3 py-2 font-medium">Replies</th>
                    <th className="px-3 py-2 font-medium">Reposts</th>
                    <th className="px-3 py-2 font-medium">Zaps</th>
                    <th className="px-3 py-2 font-medium">Sats</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.points.map((point) => (
                    <tr key={point.id} className="border-border border-t">
                      <td className="px-3 py-2">{point.checkedAt}</td>
                      {point.missingFromIndex ? (
                        <td className="text-muted px-3 py-2" colSpan={5}>
                          Not in the index
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 tabular-nums">
                            {point.reactions}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {point.replies}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {point.reposts}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {point.zaps}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {point.sats}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
