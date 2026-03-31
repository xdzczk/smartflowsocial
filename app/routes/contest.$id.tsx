import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { getContestPublicPageData } from "~/features/contest";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params["id"];
  if (!id) throw new Response("Not found", { status: 404 });
  const data = await getContestPublicPageData(id);
  if (!data) throw new Response("Not found", { status: 404 });
  return json(data);
}

export default function PublicContestPageRoute() {
  const data = useLoaderData<typeof loader>();

  const copyLines = useCallback((lines: string[] | null, label: string) => {
    if (!lines?.length) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        toast.success(`${label} copied`);
      } catch {
        toast.error("Copy failed");
      }
    })();
  }, []);

  const isCompleted = data.status === "COMPLETED";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <p className="text-muted-foreground text-sm">
          {data.status} · ranked by {data.rankingMetric.toLowerCase()} · ends{" "}
          {new Date(data.contestEndAt).toLocaleString()}
        </p>
        <p className="text-sm">
          {isCompleted
            ? `Final results · top ${data.winnerCount} winners · ${data.plannedPayoutSats.toLocaleString()} sats planned.`
            : `Reply to the source post before the deadline. Top ${data.winnerCount} winners split ${data.plannedPayoutSats.toLocaleString()} sats.`}
        </p>
        {data.sourceNoteId ? (
          <a
            href={`https://njump.me/${data.sourceNoteId}`}
            className="text-primary text-sm hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open source post
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">
            No source post linked
          </span>
        )}
      </header>

      {isCompleted && data.publicSummaryLines ? (
        <section className="border-border bg-card space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Public summary</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  copyLines(data.publicSummaryLines, "Summary");
                }}
              >
                Copy summary
              </Button>
              {data.fairnessProofLines ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    copyLines(data.fairnessProofLines, "Fairness proof");
                  }}
                >
                  Copy fairness proof
                </Button>
              ) : null}
            </div>
          </div>
          {data.eligibleEntries != null ? (
            <p className="text-muted-foreground text-xs">
              Eligible entries (snapshot):{" "}
              {data.eligibleEntries.toLocaleString()}
            </p>
          ) : null}
          <pre className="bg-muted/30 max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {data.publicSummaryLines.join("\n")}
          </pre>
        </section>
      ) : null}

      <section className="border-border bg-card rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Leaderboard</h2>
        {data.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.rows.map((row) => (
              <li
                key={row.entryEventId}
                className="border-border bg-background rounded-md border p-3"
              >
                <p className="text-sm font-medium">
                  #{row.rank} · {row.authorPubkey.slice(0, 12)}…
                </p>
                <p className="text-muted-foreground text-xs">
                  score {row.score} · {row.replySnippet ?? "(no text)"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-muted-foreground text-xs">
        Powered by SmartFlow Social ·{" "}
        <Link to="/dashboard/contests" className="hover:underline">
          Create your own contest
        </Link>
      </footer>
    </div>
  );
}
