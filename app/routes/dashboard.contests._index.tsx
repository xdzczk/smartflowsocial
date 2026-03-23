import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { deleteContest, listContests } from "~/features/contest";
import { formatContestStatusLabel } from "~/features/contest/contest-status-ui";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const contests = await listContests(userId);
  return json({
    contests: contests.map((c) => ({
      id: c.id,
      title: c.title ?? `Contest ${c.id.slice(0, 8)}`,
      status: c.status,
      statusLabel: formatContestStatusLabel(c.status),
      metric: c.rankingMetric,
      endAt: c.contestEndAt.toISOString(),
      winners: c.winnerCount,
      plannedPayoutSats: c.plannedPayoutSats ?? 0,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "delete") {
    const contestId = formData.get("contestId");
    if (typeof contestId !== "string" || !contestId.trim()) {
      return json({ error: "Missing contest id" }, { status: 400 });
    }
    const result = await deleteContest(userId, contestId);
    if (!result.success) {
      return json({ error: result.error ?? "Delete failed" }, { status: 400 });
    }
    return redirect("/dashboard/contests");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function ContestsIndexRoute() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contests</h1>
        <Link
          className="text-primary text-sm font-medium hover:underline"
          to="/dashboard/contests/new"
        >
          New contest
        </Link>
      </div>

      {data.contests.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No contests yet. Create one to launch your first ranked campaign.
        </p>
      ) : (
        <div className="border-border divide-border overflow-hidden rounded-lg border">
          {data.contests.map((contest) => (
            <div
              key={contest.id}
              className="bg-card flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{contest.title}</p>
                <p className="text-muted-foreground text-xs">
                  {contest.statusLabel} · {contest.metric.toLowerCase()} ·{" "}
                  {contest.winners} winners
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to={`/dashboard/contests/detail/${contest.id}`}
                  className="text-primary text-sm hover:underline"
                >
                  Open
                </Link>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="contestId" value={contest.id} />
                  <button
                    type="submit"
                    className="text-destructive text-sm hover:underline"
                  >
                    Delete
                  </button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
