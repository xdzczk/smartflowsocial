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
      name: preset.name,
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

  const name = formData.get("name");
  const giveaway = await createGiveaway(userId, {
    name: typeof name === "string" ? name.trim() || undefined : undefined,
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
        <form method="post" className="mb-6 space-y-3">
          <div>
            <label
              htmlFor="giveaway-name"
              className="text-muted-foreground mb-1 block text-sm"
            >
              Giveaway name (optional)
            </label>
            <input
              id="giveaway-name"
              name="name"
              type="text"
              placeholder="e.g. March engagement giveaway"
              className="border-border bg-background w-full max-w-sm rounded border px-3 py-2 text-sm"
            />
          </div>
          <input type="hidden" name="intent" value="create" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium"
          >
            Create default giveaway
          </button>
        </form>

        <div className="border-border border-t pt-4">
          <h2 className="text-foreground mb-2 text-sm font-semibold">
            Or use a preset
          </h2>
          {presets.length > 0 ? (
            <div className="flex flex-col gap-2">
              {presets.map((p) => (
                <form
                  key={p.id}
                  method="post"
                  className="border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <input type="hidden" name="intent" value="createFromPreset" />
                  <input type="hidden" name="presetId" value={p.id} />
                  <div>
                    <p className="text-foreground font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.scopeType} · {p.winnerCount} winner
                      {p.winnerCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="border-border bg-background shrink-0 rounded-md border px-4 py-2 text-sm"
                  >
                    Create from preset
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No presets yet. Create a giveaway and save it as a preset from the
              detail page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
