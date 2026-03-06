import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { createGiveaway } from "~/features/giveaway/giveaway-actions.server";
import {
  getGiveawayPresetsByUser,
  getGiveawayPresetById,
  resolvePresetQueue,
} from "~/features/giveaway/giveaway-presets.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");
  const presets = await getGiveawayPresetsByUser(userId);
  return json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      scopeType: p.scopeType,
      winnerCount: p.winnerCount,
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");

  if (request.method !== "POST") {
    return redirect("/dashboard/giveaway");
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const presetId = formData.get("presetId");

  if (intent === "createFromPreset" && typeof presetId === "string") {
    const preset = await getGiveawayPresetById(userId, presetId);
    if (!preset) {
      return json({ error: "Preset not found" }, { status: 404 });
    }
    const scopeRef = preset.scopeReference as Record<string, unknown>;
    if (preset.scopeType === "QUEUE" && scopeRef["queueId"]) {
      await resolvePresetQueue(userId, scopeRef);
      // If queue was deleted, create anyway; getPostsInScope will return [] until user fixes scope
    }
    const giveaway = await createGiveaway(userId, {
      scopeType: preset.scopeType,
      scopeReference: scopeRef,
      engagementTypes: preset.engagementTypes as string[],
      winnerCount: preset.winnerCount,
      selectionMode: preset.selectionMode,
      engagementWeights: preset.engagementWeights as Record<
        string,
        number
      > | null,
      filters: preset.filters as Record<string, unknown> | null,
    });
    return redirect(`/dashboard/giveaway/detail/${giveaway.id}`);
  }

  if (intent !== "create") {
    return redirect("/dashboard/giveaway");
  }

  const giveaway = await createGiveaway(userId, {
    scopeType: "PERIOD",
    scopeReference: { days: 7 },
    engagementTypes: ["REACTION", "REPOST", "COMMENT", "ZAP"],
    winnerCount: 3,
    selectionMode: "UNIQUE_USER",
  });

  return redirect(`/dashboard/giveaway/detail/${giveaway.id}`);
}

export default function DashboardGiveawayNewPage() {
  const { presets } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/giveaway"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Giveaways
        </Link>
      </div>
      <div className="border-border bg-card rounded-lg border p-6">
        <h1 className="text-foreground mb-2 text-xl font-bold">New giveaway</h1>
        <p className="text-muted-foreground mb-4 text-sm">
          Create a giveaway with default settings (last 7 days, 3 winners), or
          use a preset.
        </p>
        <form method="post" className="mb-4">
          <input type="hidden" name="intent" value="create" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2"
          >
            Create default giveaway
          </button>
        </form>
        {presets.length > 0 ? (
          <form method="post" className="flex items-center gap-2">
            <input type="hidden" name="intent" value="createFromPreset" />
            <select
              name="presetId"
              className="border-border bg-background rounded border px-2 py-1"
              required
            >
              <option value="">Use preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.scopeType}, {p.winnerCount} winners)
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border-border rounded-md border px-4 py-2 text-sm"
            >
              Create from preset
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
