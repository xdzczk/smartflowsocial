import type { BroadcastDeliveryMode } from "@prisma/client";
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
} from "@remix-run/react";
import { useMemo, useState } from "react";

import { requireUserId } from "~/features/auth";
import {
  BroadcastActionError,
  createBroadcastDraft,
  resolveRecipientsForCampaign,
  getBroadcastCampaignForUser,
  listBroadcastSavedAudiences,
} from "~/features/broadcast";
import { parseCustomRecipientPaste } from "~/features/broadcast/broadcast-custom-parse";
import { broadcastCompatibilityForecastNote } from "~/features/broadcast/broadcast-delivery-copy";
import { getBroadcastMessageLintWarnings } from "~/features/broadcast/broadcast-message-lint";
import { createBroadcastDraftSchema } from "~/features/broadcast/broadcast-types";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { getSubscriptionData } from "~/features/payments/subscriptions.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const savedAudienceId = url.searchParams.get("savedAudienceId");
  const notice = url.searchParams.get("notice");
  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);

  if (!campaignId) {
    const savedAudiences = await listBroadcastSavedAudiences(userId);
    const savedForNew = savedAudienceId
      ? (savedAudiences.find((s) => s.id === savedAudienceId) ?? null)
      : null;
    return json({
      campaign: null,
      limits,
      planType,
      notice,
      savedAudiences,
      savedForNew,
    });
  }

  const campaign = await getBroadcastCampaignForUser(campaignId, userId);
  if (!campaign) {
    return json({
      campaign: null,
      limits,
      planType,
      notice,
      savedAudiences: [],
      savedForNew: null,
    });
  }

  return json({
    campaign,
    limits,
    planType,
    notice,
    savedAudiences: [],
    savedForNew: null,
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
    .split(/[\r\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);
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

  if (intent === "resolve") {
    return handleBroadcastResolveIntent(userId, form);
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

type BroadcastNewLoaderData = SerializeFrom<typeof loader>;

function BroadcastNewDraftForm({
  limits,
  planType,
  busy,
  actionError,
  savedAudiences,
  savedForNew,
}: {
  limits: BroadcastNewLoaderData["limits"];
  planType: BroadcastNewLoaderData["planType"];
  busy: boolean;
  actionError: string | null;
  savedAudiences: BroadcastNewLoaderData["savedAudiences"];
  savedForNew: BroadcastNewLoaderData["savedForNew"];
}) {
  const [messageLen, setMessageLen] = useState(0);
  const [messageBody, setMessageBody] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("BEST_COMPATIBILITY");
  const [customRaw, setCustomRaw] = useState(
    () => savedForNew?.customNpubLines.join("\n") ?? ""
  );

  const customStats = useMemo(
    () => parseCustomRecipientPaste(customRaw),
    [customRaw]
  );
  const messageLint = useMemo(
    () => getBroadcastMessageLintWarnings(messageBody),
    [messageBody]
  );

  return (
    <Form
      method="post"
      key={savedForNew?.id ?? "new-draft"}
      className="grid gap-8 lg:grid-cols-[1fr_minmax(260px,320px)]"
    >
      <div className="space-y-4">
        {actionError ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {actionError}
          </div>
        ) : null}
        {savedAudiences.length > 0 ? (
          <div>
            <label
              htmlFor="broadcast-saved-audience-select"
              className="mb-1 block text-sm font-medium"
            >
              Load saved audience
            </label>
            <select
              id="broadcast-saved-audience-select"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v)
                  window.location.href = `/dashboard/broadcasts/new?savedAudienceId=${encodeURIComponent(v)}`;
              }}
            >
              <option value="">—</option>
              {savedAudiences
                .filter((s) => s != null)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        <div>
          <label
            htmlFor="broadcast-draft-name"
            className="mb-1 block text-sm font-medium"
          >
            Name
          </label>
          <input
            id="broadcast-draft-name"
            name="name"
            required
            defaultValue={savedForNew?.name ?? ""}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            placeholder="March product update · Giveaway follow-up · Beta wave 1"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Internal only. Recipients will not see this label.
          </p>
        </div>
        <div>
          <label
            htmlFor="broadcast-audience-type"
            className="mb-1 block text-sm font-medium"
          >
            Audience source
          </label>
          <select
            id="broadcast-audience-type"
            name="audienceType"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            defaultValue={savedForNew?.audienceType ?? "CUSTOM"}
          >
            <option value="CUSTOM">Custom list (npubs / hex)</option>
            {limits.allowedAudienceTypes.includes("FOLLOWING") ? (
              <option value="FOLLOWING">Following (accounts you follow)</option>
            ) : null}
            {limits.allowedAudienceTypes.includes("FOLLOWERS") ? (
              <option value="FOLLOWERS">
                Followers (accounts that follow you)
              </option>
            ) : null}
            {limits.allowedAudienceTypes.includes("MUTUALS") ? (
              <option value="MUTUALS">Mutuals</option>
            ) : null}
          </select>
        </div>
        <div>
          <label
            htmlFor="broadcast-custom-npubs"
            className="mb-1 block text-sm font-medium"
          >
            Custom recipients (lines or comma-separated)
          </label>
          <textarea
            id="broadcast-custom-npubs"
            name="customNpubs"
            rows={6}
            value={customRaw}
            onChange={(e) => setCustomRaw(e.target.value)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="npub1… or 64-char hex"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            {customStats.parsedLines} entries parsed · {customStats.valid} valid
            · {customStats.duplicatesRemoved} duplicates removed ·{" "}
            {customStats.invalid} invalid
          </p>
        </div>
        <div>
          <label
            htmlFor="broadcast-message-body"
            className="mb-1 block text-sm font-medium"
          >
            Message
          </label>
          <textarea
            id="broadcast-message-body"
            name="messageBody"
            required
            rows={8}
            maxLength={8000}
            value={messageBody}
            onChange={(e) => {
              setMessageBody(e.target.value);
              setMessageLen(e.target.value.length);
            }}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {messageLen} / 8000 characters ·{" "}
            {messageBody ? messageBody.split(/\r?\n/).length : 0} lines
          </p>
          {messageLint.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
              {messageLint.map((w) => (
                <li key={`${w.level}:${w.message}`}>{w.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="broadcast-delivery-mode"
              className="mb-1 block text-sm font-medium"
            >
              Delivery mode
            </label>
            <select
              id="broadcast-delivery-mode"
              name="deliveryMode"
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="BEST_COMPATIBILITY">
                Best compatibility (recommended)
              </option>
              {limits.allowAdvancedDelivery ? (
                <>
                  <option value="NIP04_ONLY">NIP-04 only (legacy)</option>
                  <option value="NIP17_ONLY">NIP-17 only</option>
                  <option value="NIP17_FALLBACK_NIP04">
                    Dual / NIP-17 with fallback
                  </option>
                  <option value="BOTH">Expert: send both</option>
                </>
              ) : null}
            </select>
          </div>
          <div>
            <label
              htmlFor="broadcast-send-strategy"
              className="mb-1 block text-sm font-medium"
            >
              Strategy
            </label>
            <select
              id="broadcast-send-strategy"
              name="sendStrategy"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              disabled={!limits.allowStaggered}
            >
              <option value="STANDARD">Standard (balanced concurrency)</option>
              {limits.allowStaggered ? (
                <option value="STAGGERED">
                  Staggered (conservative pacing)
                </option>
              ) : null}
            </select>
          </div>
        </div>
        {limits.allowSchedule ? (
          <div>
            <label
              htmlFor="broadcast-scheduled-for"
              className="mb-1 block text-sm font-medium"
            >
              Schedule (required for “Schedule”; optional for send now)
            </label>
            <input
              id="broadcast-scheduled-for"
              type="datetime-local"
              name="scheduledFor"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        ) : null}
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground">Broadcast now</strong> resolves
          the audience, then opens mandatory review before signing.
          <strong className="text-foreground"> Schedule</strong> requires a date
          and time above.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            name="intent"
            value="create_draft"
            disabled={busy}
            className="border-input bg-background hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="submit"
            name="intent"
            value="create_now"
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Continue (resolve &amp; review)
          </button>
          {limits.allowSchedule ? (
            <button
              type="submit"
              name="intent"
              value="create_schedule"
              disabled={busy}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Schedule via review
            </button>
          ) : null}
        </div>
      </div>

      <aside className="border-border bg-muted/20 h-fit space-y-4 rounded-lg border p-4 text-sm lg:sticky lg:top-4">
        <h2 className="font-medium">Live summary</h2>
        <p className="text-muted-foreground text-xs">
          Estimated custom recipients (after de-dupe):{" "}
          <strong className="text-foreground">{customStats.valid}</strong>
        </p>
        <p className="text-muted-foreground text-xs">
          Plan: {planType} · max {limits.maxRecipientsPerCampaign} per broadcast
          {limits.maxDailyBroadcastRecipients > 0
            ? ` · ${String(limits.maxDailyBroadcastRecipients)}/day`
            : null}
        </p>
        <p className="text-muted-foreground text-xs">
          Suppressed accounts are excluded automatically.{" "}
          <Link
            to="/dashboard/broadcasts/suppression"
            className="text-primary font-medium hover:underline"
          >
            Manage suppression
          </Link>
        </p>
        <div>
          <h3 className="text-xs font-medium tracking-wide uppercase">
            Delivery note
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            {broadcastCompatibilityForecastNote(
              deliveryMode as BroadcastDeliveryMode
            )}
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Send signed Nostr direct messages to selected audiences. Use
          broadcasts for meaningful updates, not noise.
        </p>
      </aside>
    </Form>
  );
}

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
  const { campaign, limits, planType, notice, savedAudiences, savedForNew } =
    useLoaderData<typeof loader>();
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

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New broadcast</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send signed Nostr direct messages to selected audiences. Use
          broadcasts for meaningful updates, not noise.
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
