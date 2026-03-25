import type { ContestPreset } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { requireUserId } from "~/features/auth";
import {
  deleteContestPreset,
  getContestPresetsForUser,
} from "~/features/contest";
import {
  getSubscriptionData,
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import {
  getGiveawayPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";
import { featureFlags } from "~/lib/feature-flags.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const sub = await getSubscriptionData(userId);
  const limits = getGiveawayPlanLimits(
    getUserPlanType(sub.currentSubscription ?? null)
  );
  const presets: ContestPreset[] = limits.canUsePresets
    ? await getContestPresetsForUser(userId)
    : [];
  return json({
    presets: presets.map((p: ContestPreset) => ({
      id: p.id,
      name: p.name,
      rankingMetric: p.rankingMetric,
      prizeMode: p.prizeMode,
      winnerCount: p.winnerCount,
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    })),
    canUsePresets: limits.canUsePresets,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const sub = await getSubscriptionData(userId);
  const limits = getGiveawayPlanLimits(
    getUserPlanType(sub.currentSubscription ?? null)
  );
  if (!limits.canUsePresets) {
    return json({ error: "Presets require a paid plan" }, { status: 403 });
  }
  const fd = await request.formData();
  const intent = fd.get("intent");
  if (intent === "delete") {
    const id = fd.get("presetId");
    if (typeof id !== "string" || !id.trim()) {
      return json({ error: "Missing preset" }, { status: 400 });
    }
    await deleteContestPreset(userId, id.trim());
    return redirect("/dashboard/contests/presets");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function ContestPresetsPage() {
  const { presets, canUsePresets } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Presets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reuse ranking metric, prize structure, and eligibility filters. Pick
          the source post and end time when you start a new contest.
        </p>
      </div>

      {!canUsePresets ? (
        <p className="text-muted-foreground text-sm">
          Upgrade to a paid plan to save and manage contest presets.
        </p>
      ) : presets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No presets yet. On a draft contest detail page, use{" "}
          <span className="text-foreground font-medium">Save as preset</span>.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 font-medium">Prize</th>
                <th className="px-4 py-3 font-medium">Winners</th>
                <th className="px-4 py-3 font-medium">Last used</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {presets.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {p.rankingMetric}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {p.prizeMode}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.winnerCount}</td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {p.lastUsedAt
                      ? new Date(p.lastUsedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/dashboard/contests/new?preset=${p.id}`}>
                          Use
                        </Link>
                      </Button>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="presetId" value={p.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={(e) => {
                            if (!confirm(`Delete preset “${p.name}”?`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        <Link to="/dashboard/contests" className="text-primary hover:underline">
          ← All contests
        </Link>
      </p>
    </div>
  );
}
