import type { ActionFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  createContest,
  launchContest,
  touchContestPresetLastUsed,
  upsertContestCreationDraftPayload,
  upsertContestLaunchOrchestration,
} from "~/features/contest";
import type { ContestRankingMetric } from "~/features/contest/types";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { getPostById } from "~/features/posts/server";
import { featureFlags } from "~/lib/feature-flags.server";

function parseContestFairness(formData: FormData) {
  return {
    excludeMuted: formData.get("excludeMuted") === "on",
    excludeBlocked: formData.get("excludeBlocked") === "on",
    excludeLowTrust: formData.get("excludeLowTrust") === "on",
    excludeNonFollowers: formData.get("excludeNonFollowers") === "on",
    minAccountAgeDays:
      parseInt(String(formData.get("minAccountAgeDays") ?? "0"), 10) ||
      undefined,
    minFollowers:
      parseInt(String(formData.get("minFollowers") ?? "0"), 10) || undefined,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- Action branches: draft save vs launch vs presets
export async function contestNewAction({ request }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "launch");

  if (intent === "save-draft") {
    const raw = String(formData.get("draftPayload") ?? "{}");
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid draft payload" }, { status: 400 });
    }
    await upsertContestCreationDraftPayload(userId, payload);
    return json({ ok: true, draftSaved: true });
  }

  const title = String(formData.get("title") ?? "");
  const sourceMode = String(formData.get("sourceMode") ?? "existing") as
    | "create"
    | "existing";
  const launchMode = String(formData.get("launchMode") ?? "now") as
    | "now"
    | "schedule";
  const scheduledActivationRaw = String(
    formData.get("scheduledActivationFor") ?? ""
  ).trim();
  const sourcePostId = String(formData.get("sourcePostId") ?? "").trim();
  const rankingMetric = String(
    formData.get("rankingMetric") ?? "ZAPS"
  ) as ContestRankingMetric;
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

  const rankRewards: Array<{ rank: number; sats: number }> = [];
  for (let rank = 1; rank <= winnerCount; rank += 1) {
    const sats =
      parseInt(String(formData.get(`rankReward_${rank}`) ?? "0"), 10) || 0;
    rankRewards.push({ rank, sats });
  }

  if (prizeMode === "RANKED" && !rankRewards.some((r) => r.sats > 0)) {
    return json(
      { error: "Enter at least one rank reward above 0 sats." },
      { status: 400 }
    );
  }

  const contestEndAt = new Date(contestEndAtRaw);
  if (!Number.isFinite(contestEndAt.getTime())) {
    return json({ error: "Set a contest end time." }, { status: 400 });
  }

  if (contestEndAt.getTime() <= Date.now()) {
    return json(
      { error: "Set a contest end time in the future." },
      { status: 400 }
    );
  }

  const fairnessConfig = parseContestFairness(formData);
  const scheduledActivationAt =
    scheduledActivationRaw.length > 0 ? new Date(scheduledActivationRaw) : null;
  if (launchMode === "schedule") {
    if (
      !scheduledActivationAt ||
      !Number.isFinite(scheduledActivationAt.getTime())
    ) {
      return json(
        { error: "Choose a future activation date and time." },
        { status: 400 }
      );
    }
    if (scheduledActivationAt.getTime() <= Date.now()) {
      return json(
        { error: "Activation must be in the future." },
        { status: 400 }
      );
    }
    if (contestEndAt.getTime() <= scheduledActivationAt.getTime()) {
      return json(
        {
          error: "End time must be after scheduled activation.",
        },
        { status: 400 }
      );
    }
  }

  if (!sourcePostId) {
    return json(
      {
        error:
          sourceMode === "create"
            ? "Publish the source post from the contest actions first."
            : "Choose a source post.",
      },
      { status: 400 }
    );
  }

  const sourcePost = await getPostById({ id: sourcePostId, userId });
  if (!sourcePost) {
    return json({ error: "Source post not found." }, { status: 400 });
  }

  const sourceNoteId = sourcePost.nostrEventId?.trim() ?? "";
  const hasPublishedNote = sourceNoteId.length > 0;

  if (sourceMode === "existing") {
    if (!hasPublishedNote) {
      return json(
        {
          error:
            "Selected post must be published with a Nostr note id before launching.",
        },
        { status: 400 }
      );
    }
  }

  if (sourceMode === "create" && launchMode === "now" && !hasPublishedNote) {
    return json(
      {
        error:
          "Publish the source post first (use the primary contest action), then submit again.",
      },
      { status: 400 }
    );
  }

  const baseContestInput = {
    title,
    rankingMetric,
    contestEndAt,
    prizeMode,
    winnerCount,
    equalRewardSats: prizeMode === "EQUAL" ? equalRewardSats : null,
    rankRewards: prizeMode === "RANKED" ? rankRewards : null,
    fairnessConfig,
  };

  const appliedPresetId = String(formData.get("appliedPresetId") ?? "").trim();
  if (appliedPresetId) {
    try {
      await touchContestPresetLastUsed(userId, appliedPresetId);
    } catch {
      // ignore
    }
  }

  if (sourceMode === "existing") {
    if (launchMode === "now") {
      const contest = await createContest(userId, {
        ...baseContestInput,
        sourceNoteId,
        sourcePostId: sourcePost.id,
      });
      const launched = await launchContest(userId, contest.id);
      if (!launched.success) {
        return json(
          { error: launched.error ?? "Contest created but launch failed." },
          { status: 400 }
        );
      }
      return redirect(`/dashboard/contests/detail/${contest.id}`);
    }

    const contest = await createContest(userId, {
      ...baseContestInput,
      sourceNoteId,
      sourcePostId: sourcePost.id,
      status: "SCHEDULED_LAUNCH",
    });
    await upsertContestLaunchOrchestration({
      userId,
      contestId: contest.id,
      sourceMode: "existing_post",
      launchMode: "schedule",
      scheduledFor: scheduledActivationAt,
      existingSourcePostId: sourcePost.id,
      sourcePostId: null,
      sourcePostPublishStatus: "not_needed",
      contestActivationStatus: "scheduled",
    });
    return redirect(`/dashboard/contests/detail/${contest.id}`);
  }

  if (launchMode === "now") {
    const contest = await createContest(userId, {
      ...baseContestInput,
      sourceNoteId,
      sourcePostId: sourcePost.id,
    });
    const launched = await launchContest(userId, contest.id);
    if (!launched.success) {
      return json(
        { error: launched.error ?? "Contest created but launch failed." },
        { status: 400 }
      );
    }
    return redirect(`/dashboard/contests/detail/${contest.id}`);
  }

  const contest = await createContest(userId, {
    ...baseContestInput,
    sourceNoteId: hasPublishedNote ? sourceNoteId : null,
    sourcePostId: sourcePost.id,
    status: "SCHEDULED_LAUNCH",
  });

  await upsertContestLaunchOrchestration({
    userId,
    contestId: contest.id,
    sourceMode: "new_post",
    launchMode: "schedule",
    scheduledFor: scheduledActivationAt,
    existingSourcePostId: null,
    sourcePostId: sourcePost.id,
    sourcePostPublishStatus: hasPublishedNote ? "published" : "scheduled",
    contestActivationStatus: "scheduled",
  });

  return redirect(`/dashboard/contests/detail/${contest.id}`);
}

export type ContestNewActionData = SerializeFrom<typeof contestNewAction>;
