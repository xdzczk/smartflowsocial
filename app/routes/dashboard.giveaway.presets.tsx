import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { requireUserId } from "~/features/auth";
import {
  deleteGiveawayPreset,
  getGiveawayPresetsByUser,
} from "~/features/giveaway/giveaway-presets.server";
import {
  getSubscriptionData,
  requireAnySubscription,
} from "~/features/payments";
import {
  getGiveawayPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const sub = await getSubscriptionData(userId);
  const limits = getGiveawayPlanLimits(
    getUserPlanType(sub.currentSubscription ?? null)
  );
  const presets = limits.canUsePresets
    ? await getGiveawayPresetsByUser(userId)
    : [];
  return json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      scopeType: p.scopeType,
      winnerCount: p.winnerCount,
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    })),
    canUsePresets: limits.canUsePresets,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
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
    await deleteGiveawayPreset(userId, id.trim());
    return redirect("/dashboard/giveaway/presets");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function GiveawayPresetsPage() {
  const { presets, canUsePresets } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-text text-2xl font-semibold">Presets</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Reuse scope, filters, and reward settings. Start a giveaway from a
          preset in one click.
        </p>
      </div>

      {!canUsePresets ? (
        <p className="text-text-secondary text-sm">
          Upgrade to a paid plan to save and manage giveaway presets.
        </p>
      ) : presets.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No presets yet. On a giveaway detail page, use{" "}
          <span className="text-text font-medium">Save as preset</span>.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover/40 text-text-secondary text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Winners</th>
                <th className="px-4 py-3 font-medium">Last used</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {presets.map((p) => (
                <tr key={p.id} className="hover:bg-surface-hover/20">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="text-text-secondary px-4 py-3">
                    {p.scopeType}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.winnerCount}</td>
                  <td className="text-text-secondary px-4 py-3 text-xs">
                    {p.lastUsedAt
                      ? new Date(p.lastUsedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Form method="post" action="/dashboard/giveaway/new">
                        <input
                          type="hidden"
                          name="intent"
                          value="createFromPreset"
                        />
                        <input type="hidden" name="presetId" value={p.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          Use
                        </Button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="presetId" value={p.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-danger"
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

      <p className="text-text-secondary text-sm">
        <Link to="/dashboard/giveaway" className="text-brand hover:underline">
          ← All giveaways
        </Link>
      </p>
    </div>
  );
}
