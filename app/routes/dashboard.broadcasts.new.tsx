import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useOutlet,
} from "@remix-run/react";
import { useMemo } from "react";

import { BroadcastNewDraftForm } from "~/components/broadcast/BroadcastNewDraftForm";
import { requireUserId } from "~/features/auth";
import {
  BroadcastActionError,
  createBroadcastDraft,
  createBroadcastSavedAudience,
  resolveRecipientsForCampaign,
  getBroadcastCampaignForUser,
  getLatestBroadcastMessageSnippetForUser,
  listBroadcastSavedAudiences,
} from "~/features/broadcast";
import { createBroadcastDraftSchema } from "~/features/broadcast/broadcast-types";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { getSubscriptionData } from "~/features/payments/subscriptions.server";
import { getUserById } from "~/features/user";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const savedAudienceId = url.searchParams.get("savedAudienceId");
  const noticeParam = url.searchParams.get("notice");
  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);
  const user = await getUserById(userId);
  const userTimezone = user?.timezone ?? "Etc/UTC";

  if (!campaignId) {
    const unsubscribePreviewBaseUrl =
      process.env["APP_URL"]?.trim().replace(/\/$/, "") ??
      new URL(request.url).origin;
    const [savedAudiences, recentBroadcastMessageSnippet] = await Promise.all([
      listBroadcastSavedAudiences(userId),
      getLatestBroadcastMessageSnippetForUser(userId),
    ]);
    let savedForNew = savedAudienceId
      ? (savedAudiences.find((s) => s.id === savedAudienceId) ?? null)
      : null;
    const noticeParts = [noticeParam].filter(
      (s): s is string => typeof s === "string" && s.length > 0
    );
    if (
      savedForNew?.audienceType === "FOLLOWING" ||
      savedForNew?.audienceType === "FOLLOWERS"
    ) {
      savedForNew = null;
      noticeParts.push(
        "That saved audience type is no longer available. Choose Mutuals or selected recipients."
      );
    }
    const notice = noticeParts.length > 0 ? noticeParts.join(" ") : null;
    return json({
      campaign: null,
      limits,
      planType,
      notice,
      savedAudiences,
      savedForNew,
      userTimezone,
      recentBroadcastMessageSnippet,
      unsubscribePreviewBaseUrl,
    });
  }

  const unsubscribePreviewBaseUrl =
    process.env["APP_URL"]?.trim().replace(/\/$/, "") ??
    new URL(request.url).origin;
  const campaign = await getBroadcastCampaignForUser(campaignId, userId);
  if (!campaign) {
    return json({
      campaign: null,
      limits,
      planType,
      notice: noticeParam,
      savedAudiences: [],
      savedForNew: null,
      userTimezone,
      recentBroadcastMessageSnippet: null,
      unsubscribePreviewBaseUrl,
    });
  }

  return json({
    campaign,
    limits,
    planType,
    notice: noticeParam,
    savedAudiences: [],
    savedForNew: null,
    userTimezone,
    recentBroadcastMessageSnippet: null,
    unsubscribePreviewBaseUrl,
  });
}

function broadcastResolveErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof BroadcastActionError ? error.message : fallback;
}

function redirectBroadcastNewWithNotice(campaignId: string, message: string) {
  return redirect(
    `/dashboard/broadcasts/new?campaignId=${encodeURIComponent(
      campaignId
    )}&notice=${encodeURIComponent(message)}`
  );
}

function parseFormJson(raw: FormDataEntryValue | null): unknown {
  if (raw == null || typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function handleSaveAudienceIntent(userId: string, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const audienceType = String(form.get("audienceType") ?? "CUSTOM");
  const customRaw = String(form.get("customNpubs") ?? "");
  const customNpubLines = customRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!name) {
    return json({ error: "Name required" }, { status: 400 });
  }
  if (!["CUSTOM", "MUTUALS"].includes(audienceType)) {
    return json({ error: "Invalid audience" }, { status: 400 });
  }
  if (audienceType === "CUSTOM" && customNpubLines.length === 0) {
    return json(
      { error: "Add at least one valid recipient to save a custom audience." },
      { status: 400 }
    );
  }
  await createBroadcastSavedAudience(userId, {
    name,
    audienceType: audienceType as "CUSTOM" | "MUTUALS",
    customNpubLines,
    ruleSummary: "Saved from broadcast composer",
  });
  return redirect("/dashboard/broadcasts/audiences?notice=saved");
}

async function handleBroadcastCreateIntents(
  userId: string,
  form: FormData,
  intent: "create_draft" | "create_now" | "create_schedule"
) {
  const name = String(form.get("name") ?? "").trim();
  const audienceType = String(form.get("audienceType") ?? "CUSTOM");
  const messageBody = String(form.get("messageBody") ?? "").trim();
  const customRaw = String(form.get("customNpubs") ?? "");
  const customNpubLines = customRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parseSnapshotJson = parseFormJson(form.get("parseSnapshotJson"));
  const exclusionRulesJson = parseFormJson(form.get("exclusionRulesJson"));
  const deliveryMode = String(form.get("deliveryMode") ?? "BEST_COMPATIBILITY");
  const sendStrategy = String(form.get("sendStrategy") ?? "STANDARD");
  const scheduledForIsoRaw = form.get("scheduledFor");
  let scheduledForIso =
    typeof scheduledForIsoRaw === "string" && scheduledForIsoRaw.trim()
      ? new Date(scheduledForIsoRaw).toISOString()
      : undefined;

  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);

  if (intent === "create_now") {
    scheduledForIso = undefined;
  }
  if (intent === "create_schedule") {
    if (!limits.allowSchedule) {
      return json(
        {
          error: "Scheduling is not available on your plan.",
        },
        { status: 400 }
      );
    }
    if (!scheduledForIso) {
      return json(
        {
          error: "Choose a date and time for a scheduled broadcast.",
        },
        { status: 400 }
      );
    }
  }

  const parsed = createBroadcastDraftSchema.safeParse({
    name,
    audienceType,
    messageBody,
    customNpubLines,
    deliveryMode,
    sendStrategy,
    scheduledForIso,
    parseSnapshotJson,
    exclusionRulesJson,
  });
  if (!parsed.success) {
    return json(
      { error: "Check the form", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await createBroadcastDraft(userId, parsed.data);

  if (intent === "create_draft") {
    return redirect(`/dashboard/broadcasts/new?campaignId=${id}`);
  }

  try {
    await resolveRecipientsForCampaign(userId, id);
  } catch (e) {
    return redirectBroadcastNewWithNotice(
      id,
      broadcastResolveErrorMessage(
        e,
        "Could not resolve recipients. You can try “Resolve audience” on the next step."
      )
    );
  }

  return redirect(
    `/dashboard/broadcasts/new/review?campaignId=${encodeURIComponent(id)}`
  );
}

async function handleBroadcastResolveIntent(userId: string, form: FormData) {
  const campaignId = String(form.get("campaignId") ?? "");
  if (!campaignId) {
    return json({ error: "Missing campaign" }, { status: 400 });
  }
  try {
    await resolveRecipientsForCampaign(userId, campaignId);
  } catch (e) {
    return redirectBroadcastNewWithNotice(
      campaignId,
      broadcastResolveErrorMessage(
        e,
        "Could not resolve recipients right now. Try again or use a Custom list."
      )
    );
  }
  return redirect(
    `/dashboard/broadcasts/new/review?campaignId=${encodeURIComponent(campaignId)}`
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");

  if (
    intent === "create_draft" ||
    intent === "create_now" ||
    intent === "create_schedule"
  ) {
    return handleBroadcastCreateIntents(userId, form, intent);
  }

  if (intent === "save_audience") {
    return handleSaveAudienceIntent(userId, form);
  }

  if (intent === "resolve") {
    return handleBroadcastResolveIntent(userId, form);
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

type BroadcastNewLoaderData = SerializeFrom<typeof loader>;

function BroadcastNewCampaignPhase({
  campaign,
  pendingRecipients,
  busy,
  notice,
}: {
  campaign: NonNullable<BroadcastNewLoaderData["campaign"]>;
  pendingRecipients: Array<{ id: string; recipientPubkey: string }>;
  busy: boolean;
  notice: string | null;
}) {
  return (
    <div className="space-y-6">
      {notice ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
        >
          {notice}
        </div>
      ) : null}
      <div className="border-border rounded-lg border p-4">
        <h2 className="font-medium">{campaign.name}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Status: {campaign.status} · Audience: {campaign.audienceType} ·
          Recipients: {campaign.totalRecipients} (suppressed{" "}
          {campaign.suppressedCount})
        </p>
        <p className="mt-3 text-sm whitespace-pre-wrap">
          {campaign.messageBody}
        </p>
      </div>

      {(campaign.status === "DRAFT" ||
        campaign.status === "AWAITING_SIGNATURE") &&
      campaign.totalRecipients === 0 ? (
        <Form method="post">
          <input type="hidden" name="intent" value="resolve" />
          <input type="hidden" name="campaignId" value={campaign.id} />
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Resolve audience
          </button>
        </Form>
      ) : null}

      {(campaign.status === "DRAFT" ||
        campaign.status === "AWAITING_SIGNATURE") &&
      pendingRecipients.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <p className="text-sm font-medium">
            {pendingRecipients.length} recipient
            {pendingRecipients.length === 1 ? "" : "s"} ready for delivery.
          </p>
          <p className="text-muted-foreground text-sm">
            Continue to the pre-flight review to see audience breakdown,
            compatibility notes, and sign. Sending is blocked until you complete
            that step.
          </p>
          {pendingRecipients.length > 40 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Large send: you will approve many signatures. Consider smaller
              audiences on lower tiers.
            </p>
          ) : null}
          <Link
            to={`/dashboard/broadcasts/new/review?campaignId=${encodeURIComponent(campaign.id)}`}
            className="bg-primary text-primary-foreground inline-flex rounded-md px-4 py-2 text-sm font-medium"
          >
            Continue to review
          </Link>
        </div>
      ) : null}

      {campaign.status !== "DRAFT" &&
      campaign.status !== "AWAITING_SIGNATURE" ? (
        <Link
          to={`/dashboard/broadcasts/${campaign.id}`}
          className="text-primary text-sm font-medium"
        >
          Open campaign →
        </Link>
      ) : null}

      <Link
        to="/dashboard/broadcasts/new"
        className="text-muted-foreground text-sm hover:underline"
      >
        Start over
      </Link>
    </div>
  );
}

export default function BroadcastNewRoute() {
  const outlet = useOutlet();
  const {
    campaign,
    limits,
    planType,
    notice,
    savedAudiences,
    savedForNew,
    userTimezone,
    recentBroadcastMessageSnippet,
    unsubscribePreviewBaseUrl,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const actionError =
    actionData &&
    typeof actionData === "object" &&
    "error" in actionData &&
    typeof actionData.error === "string"
      ? actionData.error
      : null;

  const pendingRecipients = useMemo(
    () => campaign?.recipients.filter((r) => r.status === "PENDING") ?? [],
    [campaign]
  );

  // `dashboard.broadcasts.new.review` is a child route; without rendering the
  // outlet, /dashboard/broadcasts/new/review never shows the review UI.
  if (outlet) {
    return outlet;
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New broadcast</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send signed Nostr direct messages to selected audiences.
        </p>
      </div>

      {!campaign ? (
        <BroadcastNewDraftForm
          limits={limits}
          planType={planType}
          busy={busy}
          actionError={actionError}
          savedAudiences={savedAudiences}
          savedForNew={savedForNew}
          userTimezone={userTimezone}
          recentBroadcastMessageSnippet={recentBroadcastMessageSnippet}
          unsubscribePreviewBaseUrl={unsubscribePreviewBaseUrl}
        />
      ) : (
        <BroadcastNewCampaignPhase
          campaign={campaign}
          pendingRecipients={pendingRecipients}
          busy={busy}
          notice={notice}
        />
      )}
    </div>
  );
}
