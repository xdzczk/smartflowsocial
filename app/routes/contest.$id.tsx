import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <p className="text-muted-foreground text-sm">
          {data.status} · ranked by {data.rankingMetric.toLowerCase()} · ends{" "}
          {new Date(data.contestEndAt).toLocaleString()}
        </p>
        <p className="text-sm">
          Reply to the source post before the deadline. Top {data.winnerCount}{" "}
          winners split {data.plannedPayoutSats.toLocaleString()} sats.
        </p>
        <a
          href={`https://njump.me/${data.sourceNoteId}`}
          className="text-primary text-sm hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open source post
        </a>
      </header>

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
