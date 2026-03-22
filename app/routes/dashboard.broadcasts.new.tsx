import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useCallback, useMemo, useState } from "react";

import { requireUserId } from "~/features/auth";
import {
  createBroadcastDraft,
  resolveRecipientsForCampaign,
  getBroadcastCampaignForUser,
} from "~/features/broadcast";
import { buildAndSignBroadcastKind4 } from "~/features/broadcast/broadcast-dm.client";
import { createBroadcastDraftSchema } from "~/features/broadcast/broadcast-types";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { getSubscriptionData } from "~/features/payments/subscriptions.server";

interface BroadcastFinalizeCampaign {
  id: string;
  messageBody: string;
}

interface BroadcastPendingRecipient {
  id: string;
  recipientPubkey: string;
}

async function runBroadcastFinalizeFlow(
  campaign: BroadcastFinalizeCampaign,
  pendingRecipients: BroadcastPendingRecipient[],
  onSigningProgress: (index: number, total: number) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const recipientsPayload: Array<{
    recipientId: string;
    signedEvent: Record<string, unknown>;
  }> = [];
  let i = 0;
  for (const r of pendingRecipients) {
    i += 1;
    onSigningProgress(i, pendingRecipients.length);
    const signedEvent = await buildAndSignBroadcastKind4({
      recipientPubkeyHex: r.recipientPubkey,
      plaintext: campaign.messageBody,
    });
    recipientsPayload.push({
      recipientId: r.id,
      signedEvent: signedEvent as unknown as Record<string, unknown>,
    });
  }

  const res = await fetch("/api/broadcast-finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      campaignId: campaign.id,
      recipients: recipientsPayload,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Finalize failed" };
  }
  window.location.href = `/dashboard/broadcasts/${campaign.id}`;
  return { ok: true };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);

  if (!campaignId) {
    return json({ campaign: null, limits, planType });
  }

  const campaign = await getBroadcastCampaignForUser(campaignId, userId);
  if (!campaign) {
    return json({ campaign: null, limits, planType });
  }

  return json({ campaign, limits, planType });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = String(form.get("name") ?? "").trim();
    const audienceType = String(form.get("audienceType") ?? "CUSTOM");
    const messageBody = String(form.get("messageBody") ?? "").trim();
    const customRaw = String(form.get("customNpubs") ?? "");
    const customNpubLines = customRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const deliveryMode = String(
      form.get("deliveryMode") ?? "BEST_COMPATIBILITY"
    );
    const sendStrategy = String(form.get("sendStrategy") ?? "STANDARD");
    const scheduledForIsoRaw = form.get("scheduledFor");
    const scheduledForIso =
      typeof scheduledForIsoRaw === "string" && scheduledForIsoRaw.trim()
        ? new Date(scheduledForIsoRaw).toISOString()
        : undefined;

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
    return redirect(`/dashboard/broadcasts/new?campaignId=${id}`);
  }

  if (intent === "resolve") {
    const campaignId = String(form.get("campaignId") ?? "");
    if (!campaignId) {
      return json({ error: "Missing campaign" }, { status: 400 });
    }
    await resolveRecipientsForCampaign(userId, campaignId);
    return redirect(`/dashboard/broadcasts/new?campaignId=${campaignId}`);
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

type BroadcastNewLoaderData = SerializeFrom<typeof loader>;

function BroadcastNewDraftForm({
  limits,
  planType,
  busy,
}: {
  limits: BroadcastNewLoaderData["limits"];
  planType: BroadcastNewLoaderData["planType"];
  busy: boolean;
}) {
  return (
    <Form method="post" className="space-y-4">
      <input type="hidden" name="intent" value="create" />
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
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="March community update"
        />
      </div>
      <div>
        <label
          htmlFor="broadcast-audience-type"
          className="mb-1 block text-sm font-medium"
        >
          Audience
        </label>
        <select
          id="broadcast-audience-type"
          name="audienceType"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="CUSTOM">Custom list (npubs / hex)</option>
          {limits.allowedAudienceTypes.includes("FOLLOWING") ? (
            <option value="FOLLOWING">Following</option>
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
          Custom recipients (one npub or hex per line)
        </label>
        <textarea
          id="broadcast-custom-npubs"
          name="customNpubs"
          rows={6}
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
          placeholder="npub1…"
        />
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
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
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
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="BEST_COMPATIBILITY">Best compatibility</option>
            {limits.allowAdvancedDelivery ? (
              <>
                <option value="NIP04_ONLY">NIP-04 only</option>
                <option value="NIP17_ONLY">NIP-17 only</option>
                <option value="NIP17_FALLBACK_NIP04">NIP-17 then NIP-04</option>
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
            <option value="STANDARD">Standard</option>
            {limits.allowStaggered ? (
              <option value="STAGGERED">Staggered</option>
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
            Schedule (optional, local time)
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
        Plan: {planType} · max {limits.maxRecipientsPerCampaign} recipients per
        broadcast.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        Save draft
      </button>
    </Form>
  );
}

function BroadcastNewCampaignPhase({
  campaign,
  pendingRecipients,
  busy,
  finalizeError,
  finalizeProgress,
  onFinalize,
}: {
  campaign: NonNullable<BroadcastNewLoaderData["campaign"]>;
  pendingRecipients: BroadcastPendingRecipient[];
  busy: boolean;
  finalizeError: string | null;
  finalizeProgress: string | null;
  onFinalize: () => void;
}) {
  return (
    <div className="space-y-6">
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

      {campaign.status === "DRAFT" && campaign.totalRecipients === 0 ? (
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

      {campaign.status === "DRAFT" && pendingRecipients.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm">
            {pendingRecipients.length} recipient
            {pendingRecipients.length === 1 ? "" : "s"} ready. Confirm your
            signer is connected, then sign and enqueue delivery (same model as
            scheduled posts: we store signed events and workers publish).
          </p>
          {pendingRecipients.length > 40 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Large send: you will approve many signatures. Consider smaller
              audiences on lower tiers.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onFinalize}
            disabled={!!finalizeProgress}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Sign &amp; send / schedule
          </button>
          {finalizeProgress ? (
            <p className="text-muted-foreground text-sm">{finalizeProgress}</p>
          ) : null}
          {finalizeError ? (
            <p className="text-destructive text-sm">{finalizeError}</p>
          ) : null}
        </div>
      ) : null}

      {campaign.status !== "DRAFT" ? (
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
  const { campaign, limits, planType } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const pendingRecipients = useMemo(
    () => campaign?.recipients.filter((r) => r.status === "PENDING") ?? [],
    [campaign]
  );

  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeProgress, setFinalizeProgress] = useState<string | null>(null);

  const runFinalize = useCallback(async () => {
    if (!campaign || pendingRecipients.length === 0) return;
    setFinalizeError(null);
    setFinalizeProgress("Signing…");
    try {
      const result = await runBroadcastFinalizeFlow(
        campaign,
        pendingRecipients,
        (index, total) => {
          setFinalizeProgress(`Signing ${String(index)}/${String(total)}…`);
        }
      );
      if (!result.ok) {
        setFinalizeError(result.error);
        setFinalizeProgress(null);
      }
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : "Finalize failed");
      setFinalizeProgress(null);
    }
  }, [campaign, pendingRecipients]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New broadcast</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Mass private messaging can feel intrusive if overused. Use broadcasts
          for relevant updates, not noise.
        </p>
      </div>

      {!campaign ? (
        <BroadcastNewDraftForm
          limits={limits}
          planType={planType}
          busy={busy}
        />
      ) : (
        <BroadcastNewCampaignPhase
          campaign={campaign}
          pendingRecipients={pendingRecipients}
          busy={busy}
          finalizeError={finalizeError}
          finalizeProgress={finalizeProgress}
          onFinalize={() => {
            void runFinalize();
          }}
        />
      )}
    </div>
  );
}
