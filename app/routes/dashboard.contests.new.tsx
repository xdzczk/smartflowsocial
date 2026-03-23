/* eslint-disable jsx-a11y/label-has-associated-control -- Builder form is temporary v1 scaffold to be replaced by shared form controls. */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { createContest } from "~/features/contest";
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
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "");
  const sourceNoteId = String(formData.get("sourceNoteId") ?? "").trim();
  const rankingMetric = String(formData.get("rankingMetric") ?? "ZAPS") as
    | "REACTIONS"
    | "ZAPS"
    | "SATS_ZAPPED";
  const contestEndAtRaw = String(formData.get("contestEndAt") ?? "");
  const prizeMode = String(formData.get("prizeMode") ?? "EQUAL") as
    | "EQUAL"
    | "RANKED";
  const winnerCount = Math.max(
    1,
    parseInt(String(formData.get("winnerCount") ?? "1"), 10) || 1
  );
  const equalRewardSats = Math.max(
    0,
    parseInt(String(formData.get("equalRewardSats") ?? "0"), 10) || 0
  );

  const rankRewards = [1, 2, 3]
    .map((rank) => {
      const sats =
        parseInt(String(formData.get(`rankReward${rank}`) ?? "0"), 10) || 0;
      return { rank, sats };
    })
    .filter((row) => row.sats > 0);

  if (!sourceNoteId) {
    return json({ error: "Source note id is required" }, { status: 400 });
  }

  const contestEndAt = new Date(contestEndAtRaw);
  if (!Number.isFinite(contestEndAt.getTime())) {
    return json(
      { error: "Valid contest end date is required" },
      { status: 400 }
    );
  }

  const contest = await createContest(userId, {
    title,
    sourceNoteId,
    rankingMetric,
    contestEndAt,
    prizeMode,
    winnerCount,
    equalRewardSats: prizeMode === "EQUAL" ? equalRewardSats : null,
    rankRewards: prizeMode === "RANKED" ? rankRewards : null,
    fairnessConfig: {
      excludeMuted: formData.get("excludeMuted") === "on",
      excludeBlocked: formData.get("excludeBlocked") === "on",
      excludeLowTrust: formData.get("excludeLowTrust") === "on",
      excludeNonFollowers: formData.get("excludeNonFollowers") === "on",
      minAccountAgeDays:
        parseInt(String(formData.get("minAccountAgeDays") ?? "0"), 10) ||
        undefined,
      minFollowers:
        parseInt(String(formData.get("minFollowers") ?? "0"), 10) || undefined,
    },
  });

  return redirect(`/dashboard/contests/detail/${contest.id}`);
}

export default function NewContestRoute() {
  const actionData = useActionData<typeof action>();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">New Contest</h1>
        <p className="text-muted-foreground text-sm">
          Source post → ranking metric → deadline → prize structure → fairness.
        </p>
      </div>

      {actionData?.error ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {actionData.error}
        </div>
      ) : null}

      <Form method="post" className="space-y-6">
        <section className="space-y-2">
          <label className="text-sm font-medium" htmlFor="title">
            Contest title
          </label>
          <input
            id="title"
            name="title"
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium" htmlFor="sourceNoteId">
            Source note id
          </label>
          <input
            id="sourceNoteId"
            name="sourceNoteId"
            required
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-muted-foreground text-xs">
            Each direct reply to this note is an entry.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="rankingMetric">
              Ranking metric
            </label>
            <select
              id="rankingMetric"
              name="rankingMetric"
              defaultValue="ZAPS"
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="REACTIONS">Most reactions</option>
              <option value="ZAPS">Most zaps</option>
              <option value="SATS_ZAPPED">Most sats zapped</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="contestEndAt">
              Contest end time
            </label>
            <input
              id="contestEndAt"
              name="contestEndAt"
              type="datetime-local"
              required
              className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-sm font-medium">Prize structure</label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="border-border bg-card flex items-center gap-2 rounded-md border p-3 text-sm">
              <input
                type="radio"
                name="prizeMode"
                value="EQUAL"
                defaultChecked
              />
              Equal rewards
            </label>
            <label className="border-border bg-card flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="radio" name="prizeMode" value="RANKED" />
              Rank-based rewards
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm" htmlFor="winnerCount">
                Number of winners
              </label>
              <input
                id="winnerCount"
                name="winnerCount"
                type="number"
                min={1}
                max={50}
                defaultValue={3}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm" htmlFor="equalRewardSats">
                Sats per winner (equal mode)
              </label>
              <input
                id="equalRewardSats"
                name="equalRewardSats"
                type="number"
                min={0}
                defaultValue={1000}
                className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input
              name="rankReward1"
              type="number"
              min={0}
              placeholder="1st sats"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="rankReward2"
              type="number"
              min={0}
              placeholder="2nd sats"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="rankReward3"
              type="number"
              min={0}
              placeholder="3rd sats"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium">Fairness exclusions</label>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>
              <input type="checkbox" name="excludeMuted" /> Exclude muted
            </label>
            <label>
              <input type="checkbox" name="excludeBlocked" /> Exclude blocked
            </label>
            <label>
              <input type="checkbox" name="excludeLowTrust" /> Exclude low trust
            </label>
            <label>
              <input type="checkbox" name="excludeNonFollowers" /> Exclude
              non-followers
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="minAccountAgeDays"
              type="number"
              min={0}
              placeholder="Min account age (days)"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="minFollowers"
              type="number"
              min={0}
              placeholder="Min followers"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Create contest draft
          </button>
          <Link
            to="/dashboard/contests"
            className="text-muted-foreground text-sm hover:underline"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}
/* eslint-enable jsx-a11y/label-has-associated-control */
