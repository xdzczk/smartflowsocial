import { Form } from "@remix-run/react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { AudienceGraphPanel } from "~/components/broadcast/audience/AudienceGraphPanel";
import {
  AudienceSourceCards,
  type AudienceMode,
} from "~/components/broadcast/audience/AudienceSourceCards";
import { RecipientPicker } from "~/components/broadcast/audience/RecipientPicker";
import { BroadcastCreationRail } from "~/components/broadcast/BroadcastCreationRail";
import type { BroadcastCommitMode } from "~/components/broadcast/BroadcastRailModeTabs";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from "~/components/ui/form-field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { getBroadcastMessageLintWarnings } from "~/features/broadcast/broadcast-message-lint";
import { getBroadcastScheduleTimeLabel } from "~/features/broadcast/broadcast-schedule-label";
import { formatBroadcastUnsubscribeFooter } from "~/features/broadcast/broadcast-unsubscribe-copy";
import { campaignFieldClassNames } from "~/features/campaign-ui";
import {
  addHours,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

const UNSUBSCRIBE_PREVIEW_TOKEN = "your_unique_token";

function normalizeHexLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const p = line.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/i.test(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function broadcastPrimaryCtaLabel(
  busy: boolean,
  commitMode: BroadcastCommitMode,
  hasScheduleTimeForSubmit: boolean,
  scheduleTimeLabel: string | null
): string {
  if (busy) return commitMode === "schedule" ? "Scheduling…" : "Continuing…";
  if (commitMode === "schedule") {
    if (hasScheduleTimeForSubmit && scheduleTimeLabel) {
      return `Review & schedule · ${scheduleTimeLabel}`;
    }
    return "Review & schedule";
  }
  return "Review broadcast";
}

function FormSection(props: {
  step: string;
  title: string;
  purpose: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-text text-lg font-semibold tracking-tight">
          <span className="text-text-secondary mr-2 font-mono text-base tabular-nums">
            {props.step}
          </span>
          {props.title}
        </h2>
        <p className="text-text-secondary mt-1.5 text-sm">{props.purpose}</p>
      </div>
      <div className="border-border bg-surface/40 shadow-1 rounded-xl border p-5">
        {props.children}
      </div>
    </section>
  );
}

export interface BroadcastNewDraftFormProps {
  limits: {
    allowSchedule: boolean;
    allowAdvancedDelivery: boolean;
    allowStaggered: boolean;
    allowedAudienceTypes: string[];
    maxRecipientsPerCampaign: number;
    maxDailyBroadcastRecipients: number;
  };
  planType: string;
  busy: boolean;
  actionError: string | null;
  savedAudiences: Array<{
    id: string;
    name: string;
    audienceType: string;
    customNpubLines: string[];
    ruleSummary: string | null;
    lastResolvedSize: number | null;
    updatedAt: string;
  }>;
  savedForNew: {
    id: string;
    name: string;
    audienceType: string;
    customNpubLines: string[];
  } | null;
  userTimezone: string;
  recentBroadcastMessageSnippet?: string | null;
  unsubscribePreviewBaseUrl: string;
}

/* eslint-disable sonarjs/cognitive-complexity -- guided composer coordinates audience, message, delivery */
export function BroadcastNewDraftForm({
  limits,
  planType,
  busy,
  actionError,
  savedAudiences,
  savedForNew,
  userTimezone,
  recentBroadcastMessageSnippet = null,
  unsubscribePreviewBaseUrl,
}: BroadcastNewDraftFormProps) {
  const savedFiltered = useMemo(
    () =>
      savedAudiences.filter(
        (s) => s.audienceType !== "FOLLOWING" && s.audienceType !== "FOLLOWERS"
      ),
    [savedAudiences]
  );

  const allowMutuals = limits.allowedAudienceTypes.includes("MUTUALS");

  const [audienceMode, setAudienceMode] = useState<AudienceMode>(() => {
    if (savedForNew?.audienceType === "MUTUALS") return "mutuals";
    if (savedForNew?.audienceType === "CUSTOM") return "selected";
    if (allowMutuals) return "mutuals";
    return "selected";
  });

  const [selectedPubkeys, setSelectedPubkeys] = useState<string[]>(() =>
    savedForNew?.audienceType === "CUSTOM"
      ? normalizeHexLines(savedForNew.customNpubLines)
      : []
  );

  const [trayStats, setTrayStats] = useState({
    selected: 0,
    suppressed: 0,
    sendable: 0,
  });

  const onSelectionStats = useCallback(
    (s: { selected: number; suppressed: number; sendable: number }) => {
      setTrayStats(s);
    },
    []
  );

  const [excludeMessagedDays, setExcludeMessagedDays] = useState(0);
  const [excludePriorBroadcastRecipients, setExcludePriorBroadcastRecipients] =
    useState(false);

  const [messageLen, setMessageLen] = useState(0);
  const [messageBody, setMessageBody] = useState("");
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("BEST_COMPATIBILITY");
  const [sendStrategy, setSendStrategy] = useState("STANDARD");
  const [commitMode, setCommitMode] = useState<BroadcastCommitMode>("now");
  const [scheduledForLocal, setScheduledForLocal] = useState("");

  const resolvedSendStrategy = limits.allowStaggered
    ? sendStrategy
    : "STANDARD";

  const effectiveCommitMode: BroadcastCommitMode = limits.allowSchedule
    ? commitMode
    : "now";

  const minDatetime = getNowForDateTimeLocal(userTimezone);
  const hasValidScheduleTime =
    scheduledForLocal.trim() !== "" &&
    !Number.isNaN(new Date(scheduledForLocal).getTime());
  const hasScheduleTimeForSubmit =
    limits.allowSchedule &&
    effectiveCommitMode === "schedule" &&
    hasValidScheduleTime;
  const scheduleTimeLabel = hasScheduleTimeForSubmit
    ? getBroadcastScheduleTimeLabel(scheduledForLocal)
    : null;

  const applyQuickSchedule = (hours: number) => {
    const min = getNowForDateTimeLocal(userTimezone);
    const now = nowInTimezone(userTimezone);
    const hoursLater = addHours(now, hours);
    const formatted = formatForDateTimeLocal(hoursLater, userTimezone);
    setScheduledForLocal(formatted < min ? min : formatted);
  };

  const effectiveAudienceType =
    audienceMode === "mutuals" ? ("MUTUALS" as const) : ("CUSTOM" as const);

  const hiddenCustomNpubs =
    audienceMode === "selected" ? selectedPubkeys.join("\n") : "";

  const parseSnapshotJson = useMemo(
    () =>
      JSON.stringify({
        version: 2,
        audienceMode,
        selectedCount: selectedPubkeys.length,
      }),
    [audienceMode, selectedPubkeys.length]
  );

  const exclusionRulesJson = useMemo(() => {
    const rules: Record<string, unknown> = {};
    if (excludeMessagedDays > 0) {
      rules["excludeMessagedWithinDays"] = excludeMessagedDays;
    }
    if (excludePriorBroadcastRecipients) {
      rules["excludePriorBroadcastRecipients"] = true;
    }
    return Object.keys(rules).length > 0 ? JSON.stringify(rules) : "";
  }, [excludeMessagedDays, excludePriorBroadcastRecipients]);

  const messageLint = useMemo(
    () =>
      getBroadcastMessageLintWarnings(messageBody, {
        recentBroadcastSnippet: recentBroadcastMessageSnippet,
      }),
    [messageBody, recentBroadcastMessageSnippet]
  );

  const [graphEstimateStats, setGraphEstimateStats] = useState<{
    count: number | null;
    fetchFailed: boolean;
  } | null>(null);

  const onGraphEstimateStats = useCallback(
    (s: { count: number | null; fetchFailed: boolean }) => {
      setGraphEstimateStats(s);
    },
    []
  );

  const audienceHeadline =
    audienceMode === "mutuals" ? "Mutuals" : "Selected recipients";

  const riskSource = audienceMode === "mutuals" ? "MUTUALS" : "CUSTOM";

  const hasMessage = messageBody.trim().length > 0;
  const unsubscribePreviewUrl = `${unsubscribePreviewBaseUrl.replace(/\/$/, "")}/broadcast/unsubscribe?t=${UNSUBSCRIBE_PREVIEW_TOKEN}`;
  const messagePreviewText = hasMessage
    ? `${messageBody}\n\n${formatBroadcastUnsubscribeFooter(unsubscribePreviewUrl)}`
    : "";

  const canContinue =
    hasMessage && (audienceMode === "mutuals" || selectedPubkeys.length > 0);

  const canSaveAudience =
    audienceMode === "selected" && selectedPubkeys.length > 0 && hasMessage;

  const primaryLabel = broadcastPrimaryCtaLabel(
    busy,
    effectiveCommitMode,
    hasScheduleTimeForSubmit,
    scheduleTimeLabel
  );

  const primaryIntent = hasScheduleTimeForSubmit
    ? "create_schedule"
    : "create_now";

  const primaryDisabled =
    busy ||
    !canContinue ||
    (effectiveCommitMode === "schedule" &&
      limits.allowSchedule &&
      !hasValidScheduleTime);

  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!hasMessage) out.push("Add a message.");
    if (audienceMode === "selected" && selectedPubkeys.length === 0) {
      out.push("Choose at least one recipient.");
    }
    if (
      effectiveCommitMode === "schedule" &&
      limits.allowSchedule &&
      !hasValidScheduleTime
    ) {
      out.push("Select a send time.");
    }
    return out;
  }, [
    hasMessage,
    audienceMode,
    selectedPubkeys.length,
    effectiveCommitMode,
    limits.allowSchedule,
    hasValidScheduleTime,
  ]);

  const advisories = useMemo(() => {
    return [
      "Suppressed recipients are excluded automatically.",
      "Only eligible recipients are included at send time.",
    ];
  }, []);

  const outcomeHeadline = useMemo(() => {
    if (
      effectiveCommitMode === "schedule" &&
      hasScheduleTimeForSubmit &&
      scheduleTimeLabel
    ) {
      return "Scheduled";
    }
    return "After review";
  }, [effectiveCommitMode, hasScheduleTimeForSubmit, scheduleTimeLabel]);

  const outcomeLine = useMemo(() => {
    if (
      effectiveCommitMode === "schedule" &&
      hasScheduleTimeForSubmit &&
      scheduleTimeLabel
    ) {
      return `for ${scheduleTimeLabel}`;
    }
    return "Sends to eligible recipients";
  }, [effectiveCommitMode, hasScheduleTimeForSubmit, scheduleTimeLabel]);

  return (
    <Form
      method="post"
      key={savedForNew?.id ?? "new-draft"}
      className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-6"
    >
      <input type="hidden" name="audienceType" value={effectiveAudienceType} />
      <input type="hidden" name="customNpubs" value={hiddenCustomNpubs} />
      <input type="hidden" name="parseSnapshotJson" value={parseSnapshotJson} />
      {exclusionRulesJson ? (
        <input
          type="hidden"
          name="exclusionRulesJson"
          value={exclusionRulesJson}
        />
      ) : null}

      <div className="min-w-0 flex-1 space-y-12">
        {actionError ? (
          <div
            role="alert"
            className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm"
          >
            {actionError}
          </div>
        ) : null}

        <FormSection
          step="1"
          title="Audience"
          purpose="Choose who should receive this direct update."
        >
          <div className="space-y-6">
            <AudienceSourceCards
              value={audienceMode}
              onChange={(m) => {
                setAudienceMode(m);
              }}
              disabled={busy}
              allowMutuals={allowMutuals}
            />

            {audienceMode === "mutuals" && allowMutuals ? (
              <div className="border-border bg-surface-hover/10 space-y-3 rounded-xl border p-4">
                <p className="text-text-secondary text-sm">
                  Resolved at send time from two-way follow relationships.
                </p>
                <span className="bg-success/15 text-success-text inline-block rounded-md px-2 py-0.5 text-[11px] font-medium">
                  Lower spam risk
                </span>
                <AudienceGraphPanel onEstimateStats={onGraphEstimateStats} />
              </div>
            ) : null}

            {audienceMode === "selected" ? (
              <RecipientPicker
                savedAudiences={savedFiltered}
                selectedPubkeys={selectedPubkeys}
                onChangeSelected={setSelectedPubkeys}
                onSelectionStats={onSelectionStats}
                disabled={busy}
              />
            ) : null}

            <div className="border-border space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">Audience exclusions</p>
              <p className="text-text-secondary text-xs">
                Applied when the final audience is resolved.
              </p>
              <div>
                <label
                  htmlFor="broadcast-exclude-recent-days-global"
                  className="text-text-secondary text-xs font-medium"
                >
                  Exclude recipients messaged in the last
                </label>
                <select
                  id="broadcast-exclude-recent-days-global"
                  className={`${campaignFieldClassNames} mt-1 max-w-xs`}
                  value={String(excludeMessagedDays)}
                  onChange={(e) => {
                    setExcludeMessagedDays(Number(e.target.value));
                  }}
                >
                  <option value="0">No extra exclusion</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
              <label
                htmlFor="broadcast-exclude-prior-recipients"
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <Checkbox
                  id="broadcast-exclude-prior-recipients"
                  checked={excludePriorBroadcastRecipients}
                  onCheckedChange={(v) =>
                    setExcludePriorBroadcastRecipients(v === true)
                  }
                  className="mt-0.5 shrink-0"
                />
                <span>
                  Exclude anyone who already received a prior completed
                  broadcast from this account.
                </span>
              </label>
            </div>

            {canSaveAudience ? (
              <div className="stack-tight border-t pt-4 sm:flex-row sm:flex-wrap">
                <Button
                  type="submit"
                  name="intent"
                  value="save_audience"
                  variant="outline"
                  disabled={busy}
                >
                  Save audience
                </Button>
              </div>
            ) : null}
          </div>
        </FormSection>

        <FormSection
          step="2"
          title="Message"
          purpose="Write what recipients will read in their DMs."
        >
          <div className="space-y-5">
            <FormField id="broadcast-internal-name" required>
              <FormLabel>Internal name</FormLabel>
              <FormControl>
                <Input
                  name="name"
                  required
                  defaultValue={savedForNew?.name ?? ""}
                  placeholder="March update · Beta list · Team note"
                />
              </FormControl>
              <FormDescription>
                For your workspace only. Recipients won’t see this.
              </FormDescription>
            </FormField>

            <FormField id="broadcast-message-body" required>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  name="messageBody"
                  required
                  rows={10}
                  maxLength={8000}
                  value={messageBody}
                  onChange={(e) => {
                    setMessageBody(e.target.value);
                    setMessageLen(e.target.value.length);
                  }}
                  className="min-h-[220px] py-3 leading-relaxed shadow-inner"
                />
              </FormControl>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-text-secondary text-xs tabular-nums">
                  {messageLen} / 8000 characters ·{" "}
                  {messageBody ? messageBody.split(/\r?\n/).length : 0} lines
                </p>
                <label
                  htmlFor="broadcast-show-message-preview"
                  className="text-text-secondary flex cursor-pointer items-center gap-2 text-xs"
                >
                  <Checkbox
                    id="broadcast-show-message-preview"
                    checked={showMessagePreview}
                    onCheckedChange={(v) => setShowMessagePreview(v === true)}
                  />
                  Preview message
                </label>
              </div>
              {showMessagePreview && hasMessage ? (
                <div
                  className="border-border bg-surface-hover/30 mt-3 rounded-lg border p-4 text-sm whitespace-pre-wrap"
                  aria-live="polite"
                >
                  {messagePreviewText}
                </div>
              ) : null}
              {showMessagePreview && hasMessage ? (
                <p className="text-text-secondary mt-2 text-xs">
                  Preview uses a sample unsubscribe link. Final send uses a
                  unique per-recipient link.
                </p>
              ) : null}
              {messageLint.length > 0 ? (
                <ul className="text-warning-text mt-3 space-y-1 text-xs">
                  {messageLint.map((w) => (
                    <li key={`${w.level}:${w.message}`}>{w.message}</li>
                  ))}
                </ul>
              ) : null}
            </FormField>
          </div>
        </FormSection>
      </div>

      <BroadcastCreationRail
        limits={{
          allowSchedule: limits.allowSchedule,
          allowAdvancedDelivery: limits.allowAdvancedDelivery,
          allowStaggered: limits.allowStaggered,
          maxRecipientsPerCampaign: limits.maxRecipientsPerCampaign,
          maxDailyBroadcastRecipients: limits.maxDailyBroadcastRecipients,
        }}
        planType={planType}
        busy={busy}
        userTimezone={userTimezone}
        commitMode={effectiveCommitMode}
        onCommitModeChange={(next) => {
          setCommitMode(next);
          if (next === "now") setScheduledForLocal("");
        }}
        deliveryMode={deliveryMode}
        onDeliveryModeChange={setDeliveryMode}
        onSendStrategyChange={setSendStrategy}
        resolvedSendStrategy={resolvedSendStrategy}
        scheduledForLocal={scheduledForLocal}
        onScheduledForChange={setScheduledForLocal}
        onQuickSchedule={applyQuickSchedule}
        minDatetime={minDatetime}
        audienceHeadline={audienceHeadline}
        riskSource={riskSource}
        estimatedGraphCount={
          audienceMode === "mutuals"
            ? (graphEstimateStats?.count ?? null)
            : undefined
        }
        graphFetchFailed={
          audienceMode === "mutuals"
            ? (graphEstimateStats?.fetchFailed ?? false)
            : false
        }
        selectedCount={
          audienceMode === "selected" ? trayStats.selected : undefined
        }
        selectedSuppressed={
          audienceMode === "selected" ? trayStats.suppressed : undefined
        }
        selectedSendable={
          audienceMode === "selected" ? trayStats.sendable : undefined
        }
        excludeRecentDays={excludeMessagedDays}
        hasScheduleTimeForSubmit={hasScheduleTimeForSubmit}
        scheduleTimeLabel={scheduleTimeLabel}
        primaryLabel={primaryLabel}
        primaryIntent={primaryIntent}
        primaryDisabled={primaryDisabled}
        draftDisabled={busy || !canContinue}
        blockers={blockers}
        advisories={advisories}
        outcomeHeadline={outcomeHeadline}
        outcomeLine={outcomeLine}
      />
    </Form>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
