import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { requireUserId } from "~/features/auth";
import { createGiveaway } from "~/features/giveaway/giveaway-actions.server";
import { getRecentPostsForGiveawaySelector } from "~/features/giveaway/giveaway-new.server";
import {
  getGiveawayPresetsByUser,
  getGiveawayPresetById,
  resolvePresetQueue,
} from "~/features/giveaway/giveaway-presets.server";
import {
  getGiveawayPlanLimits,
  getUserPlanType,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { getQueueTypes } from "~/features/user";

function parseScopeReference(
  formData: FormData,
  scopeTypeResolved: "PERIOD" | "SINGLE_POST" | "FOLLOWERS" | "FOLLOWING"
):
  | { scopeReference: Record<string, unknown> }
  | { error: string; status: 400 } {
  if (scopeTypeResolved === "PERIOD") {
    const daysRaw = formData.get("periodDays");
    const days =
      typeof daysRaw === "string" && /^\d+$/.test(daysRaw)
        ? Math.min(365, Math.max(1, parseInt(daysRaw, 10)))
        : 7;
    const queueId = formData.get("queueId");
    const queueIdTrimmed =
      typeof queueId === "string" && queueId.trim() ? queueId.trim() : "";
    const scopeReference: Record<string, unknown> = { days };
    if (queueIdTrimmed) scopeReference["queueId"] = queueIdTrimmed;
    return { scopeReference };
  }
  if (scopeTypeResolved === "SINGLE_POST") {
    const postId = formData.get("postId");
    const postIdTrimmed =
      typeof postId === "string" && postId.trim() ? postId.trim() : "";
    if (!postIdTrimmed) {
      return {
        error: "Please select a post for single-post giveaway",
        status: 400,
      };
    }
    return { scopeReference: { postId: postIdTrimmed } };
  }
  return { scopeReference: {} };
}

function parseEngagementAndWinners(formData: FormData):
  | {
      engagementTypes: string[];
      winnerCount: number;
      selectionMode: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
      engagementConfig?: Record<
        string,
        { winnerCount: number; satsPerWinner: number }
      >;
    }
  | { error: string; status: 400 } {
  const engagementTypesRaw = formData.getAll("engagementTypes");
  const allowed = ["REACTION", "REPOST", "COMMENT", "ZAP"] as const;
  const engagementTypes =
    Array.isArray(engagementTypesRaw) && engagementTypesRaw.length > 0
      ? engagementTypesRaw
          .filter((v): v is string => typeof v === "string")
          .filter((v) => allowed.includes(v as (typeof allowed)[number]))
      : (["REACTION", "REPOST", "COMMENT", "ZAP"] as string[]);
  if (engagementTypes.length === 0) {
    return { error: "Select at least one engagement type", status: 400 };
  }
  const winnerCountRaw = formData.get("winnerCount");
  const winnerCount =
    typeof winnerCountRaw === "string" && /^\d+$/.test(winnerCountRaw)
      ? Math.max(1, parseInt(winnerCountRaw, 10))
      : 3;
  const selectionMode = formData.get("selectionMode");
  const selectionModeResolved =
    selectionMode === "WEIGHTED_BY_ENGAGEMENT"
      ? "WEIGHTED_BY_ENGAGEMENT"
      : "UNIQUE_USER";

  const engagementConfig: Record<
    string,
    { winnerCount: number; satsPerWinner: number }
  > = {};
  for (const type of allowed) {
    const wRaw = formData.get(`engagementWinners_${type}`);
    const sRaw = formData.get(`engagementSats_${type}`);
    const w =
      typeof wRaw === "string" && /^\d+$/.test(wRaw)
        ? Math.max(0, parseInt(wRaw, 10))
        : 0;
    const sats =
      typeof sRaw === "string" && /^\d+$/.test(sRaw)
        ? Math.max(0, parseInt(sRaw, 10))
        : 0;
    if (w > 0 && engagementTypes.includes(type)) {
      engagementConfig[type] = { winnerCount: w, satsPerWinner: sats };
    }
  }
  return {
    engagementTypes,
    winnerCount,
    selectionMode: selectionModeResolved,
    ...(Object.keys(engagementConfig).length > 0 ? { engagementConfig } : {}),
  };
}

function parseFilters(formData: FormData): Record<string, unknown> | undefined {
  const excludeMuted =
    formData.get("excludeMuted") === "on" ||
    formData.get("excludeMuted") === "true";
  const excludeBlocked =
    formData.get("excludeBlocked") === "on" ||
    formData.get("excludeBlocked") === "true";
  const excludeLowTrust =
    formData.get("excludeLowTrust") === "on" ||
    formData.get("excludeLowTrust") === "true";
  const excludeNonFollowers =
    formData.get("excludeNonFollowers") === "on" ||
    formData.get("excludeNonFollowers") === "true";
  if (
    !excludeMuted &&
    !excludeBlocked &&
    !excludeLowTrust &&
    !excludeNonFollowers
  ) {
    return undefined;
  }
  return {
    ...(excludeMuted && { excludeMuted: true }),
    ...(excludeBlocked && { excludeBlocked: true }),
    ...(excludeLowTrust && { excludeLowTrust: true }),
    ...(excludeNonFollowers && { excludeNonFollowers: true }),
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const subscriptionData = await requireFeatureAccess(userId, "giveaways");
  const planType = getUserPlanType(
    subscriptionData.currentSubscription ?? null
  );
  const planLimits = getGiveawayPlanLimits(planType);

  const [presets, queueTypes, recentPosts] = await Promise.all([
    getGiveawayPresetsByUser(userId),
    getQueueTypes(userId),
    getRecentPostsForGiveawaySelector(userId),
  ]);

  return json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      scopeType: p.scopeType,
      winnerCount: p.winnerCount,
    })),
    queueTypes: queueTypes.map((q) => ({ id: q.id, name: q.name })),
    recentPosts,
    planLimits: {
      maxWinnerCount: planLimits.maxWinnerCount,
      canUseQueueScope: planLimits.canUseQueueScope,
      canUsePresets: planLimits.canUsePresets,
    },
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
  const scopeType = formData.get("scopeType") as
    | "PERIOD"
    | "SINGLE_POST"
    | "FOLLOWERS"
    | "FOLLOWING"
    | null;
  const scopeTypeResolved =
    scopeType === "SINGLE_POST"
      ? "SINGLE_POST"
      : scopeType === "FOLLOWERS"
        ? "FOLLOWERS"
        : scopeType === "FOLLOWING"
          ? "FOLLOWING"
          : "PERIOD";

  const scopeResult = parseScopeReference(formData, scopeTypeResolved);
  if ("error" in scopeResult) {
    return json({ error: scopeResult.error }, { status: scopeResult.status });
  }
  const { scopeReference } = scopeResult;

  const engagementResult = parseEngagementAndWinners(formData);
  if ("error" in engagementResult) {
    return json(
      { error: engagementResult.error },
      { status: engagementResult.status }
    );
  }
  const {
    engagementTypes,
    winnerCount,
    selectionMode: selectionModeResolved,
    engagementConfig,
  } = engagementResult;

  const filters = parseFilters(formData);

  try {
    const giveaway = await createGiveaway(userId, {
      name: typeof name === "string" ? name.trim() || undefined : undefined,
      scopeType: scopeTypeResolved,
      scopeReference,
      engagementTypes,
      winnerCount,
      engagementConfig: engagementConfig ?? undefined,
      selectionMode: selectionModeResolved,
      filters: filters ?? undefined,
    });
    return redirect(`/dashboard/giveaway/detail/${giveaway.id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create giveaway";
    return json({ error: message }, { status: 400 });
  }
}

const ENGAGEMENT_OPTIONS = [
  { value: "REACTION", label: "Reaction" },
  { value: "REPOST", label: "Repost" },
  { value: "COMMENT", label: "Comment" },
  { value: "ZAP", label: "Zap" },
] as const;

const PERIOD_DAYS_OPTIONS = [7, 14, 30] as const;

type ScopeType = "PERIOD" | "SINGLE_POST" | "FOLLOWERS" | "FOLLOWING";

export default function DashboardGiveawayNewPage() {
  const { presets, queueTypes, recentPosts, planLimits } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [scopeType, setScopeType] = useState<ScopeType>("PERIOD");

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
          Set custom settings below, or use a template to start from a saved
          preset.
        </p>

        <form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />

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

          <fieldset>
            <legend className="text-muted-foreground mb-2 block text-sm font-medium">
              Scope
            </legend>
            <div className="flex flex-wrap gap-4">
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scopeType"
                  value="PERIOD"
                  checked={scopeType === "PERIOD"}
                  onChange={() => setScopeType("PERIOD")}
                />
                Period (last N days)
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scopeType"
                  value="SINGLE_POST"
                  checked={scopeType === "SINGLE_POST"}
                  onChange={() => setScopeType("SINGLE_POST")}
                />
                Single post
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scopeType"
                  value="FOLLOWERS"
                  checked={scopeType === "FOLLOWERS"}
                  onChange={() => setScopeType("FOLLOWERS")}
                />
                Followers
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scopeType"
                  value="FOLLOWING"
                  checked={scopeType === "FOLLOWING"}
                  onChange={() => setScopeType("FOLLOWING")}
                />
                Following
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-4">
              {scopeType === "PERIOD" ? (
                <>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="periodDays"
                      className="text-muted-foreground text-sm"
                    >
                      Days
                    </label>
                    <select
                      id="periodDays"
                      name="periodDays"
                      className="border-border bg-background rounded border px-2 py-1 text-sm"
                      defaultValue="7"
                    >
                      {PERIOD_DAYS_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          Last {d} days
                        </option>
                      ))}
                    </select>
                  </div>
                  {planLimits.canUseQueueScope ? (
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="queueId"
                        className="text-muted-foreground text-sm"
                      >
                        Queue (optional)
                      </label>
                      <select
                        id="queueId"
                        name="queueId"
                        className="border-border bg-background min-w-[160px] rounded border px-2 py-1 text-sm"
                      >
                        <option value="">All queues</option>
                        {queueTypes.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}
              {scopeType === "SINGLE_POST" ? (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="postId"
                    className="text-muted-foreground text-sm"
                  >
                    Post
                  </label>
                  <select
                    id="postId"
                    name="postId"
                    className="border-border bg-background min-w-[200px] rounded border px-2 py-1 text-sm"
                  >
                    <option value="">Select a post</option>
                    {recentPosts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.caption
                          ? `${p.caption.slice(0, 40)}${p.caption.length > 40 ? "…" : ""}`
                          : `Post ${p.id.slice(0, 8)}`}{" "}
                        · {p.publishedAt.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </fieldset>

          <div>
            <span className="text-muted-foreground mb-2 block text-sm font-medium">
              Engagement types
            </span>
            <div className="flex flex-wrap gap-3">
              {ENGAGEMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="text-foreground flex items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="engagementTypes"
                    value={opt.value}
                    defaultChecked
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="text-muted-foreground mb-2 block text-sm font-medium">
              Winners & sats per engagement type (optional)
            </span>
            <p className="text-muted-foreground mb-2 text-xs">
              Set winner count and sats per winner for each type. If you leave
              all at 0, the single winner count below is used and no sats are
              suggested.
            </p>
            <div className="border-border bg-muted/20 grid max-w-xl gap-2 rounded border p-3 text-sm sm:grid-cols-[auto_1fr_1fr]">
              <span className="text-muted-foreground font-medium">Type</span>
              <span className="text-muted-foreground font-medium">Winners</span>
              <span className="text-muted-foreground font-medium">
                Sats each
              </span>
              {ENGAGEMENT_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className="text-foreground grid grid-cols-[auto_1fr_1fr] gap-2 sm:contents"
                >
                  <label
                    htmlFor={`engagementWinners_${opt.value}`}
                    className="flex items-center"
                  >
                    {opt.label}
                  </label>
                  <input
                    id={`engagementWinners_${opt.value}`}
                    name={`engagementWinners_${opt.value}`}
                    type="number"
                    min={0}
                    max={planLimits.maxWinnerCount}
                    defaultValue={0}
                    className="border-border bg-background w-20 rounded border px-2 py-1"
                  />
                  <input
                    id={`engagementSats_${opt.value}`}
                    name={`engagementSats_${opt.value}`}
                    type="number"
                    min={0}
                    defaultValue={0}
                    className="border-border bg-background w-24 rounded border px-2 py-1"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label
                htmlFor="winnerCount"
                className="text-muted-foreground mb-1 block text-sm"
              >
                Winner count
              </label>
              <input
                id="winnerCount"
                name="winnerCount"
                type="number"
                min={1}
                max={planLimits.maxWinnerCount}
                defaultValue={3}
                className="border-border bg-background w-20 rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="selectionMode"
                className="text-muted-foreground mb-1 block text-sm"
              >
                Selection mode
              </label>
              <select
                id="selectionMode"
                name="selectionMode"
                className="border-border bg-background rounded border px-2 py-1 text-sm"
                defaultValue="UNIQUE_USER"
              >
                <option value="UNIQUE_USER">Unique user</option>
                <option value="WEIGHTED_BY_ENGAGEMENT">
                  Weighted by engagement
                </option>
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="text-muted-foreground mb-2 block text-sm font-medium">
              Filter out users
            </legend>
            <div className="flex flex-wrap gap-4">
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input type="checkbox" name="excludeMuted" value="true" />
                Muted
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input type="checkbox" name="excludeBlocked" value="true" />
                Blacklisted
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input type="checkbox" name="excludeLowTrust" value="true" />
                Low Trust
              </label>
              <label className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="excludeNonFollowers"
                  value="true"
                />
                Non-followers
              </label>
            </div>
          </fieldset>

          {actionData && "error" in actionData ? (
            <p className="text-destructive text-sm">{actionData.error}</p>
          ) : null}
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium"
          >
            Create giveaway
          </button>
        </form>

        <div className="border-border mt-6 border-t pt-4">
          <h2 className="text-foreground mb-2 text-sm font-semibold">
            Or use a template
          </h2>
          {!planLimits.canUsePresets ? (
            <p className="text-muted-foreground text-sm">
              Upgrade your plan to save and use giveaway templates.
            </p>
          ) : presets.length > 0 ? (
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
                    Create from template
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No templates yet. Create a giveaway and save it as a template from
              the detail page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
