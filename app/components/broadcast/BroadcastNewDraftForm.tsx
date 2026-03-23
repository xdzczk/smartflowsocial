import type { BroadcastDeliveryMode } from "@prisma/client";
import { Form } from "@remix-run/react";
import { Clock, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AudienceGraphPanel } from "~/components/broadcast/audience/AudienceGraphPanel";
import { AudiencePanelCustomList } from "~/components/broadcast/audience/AudiencePanelCustomList";
import {
  AudienceSourceSelector,
  type AudienceSourceTab,
} from "~/components/broadcast/audience/AudienceSourceSelector";
import { AudienceSummaryCard } from "~/components/broadcast/audience/AudienceSummaryCard";
import { Button } from "~/components/ui/button";
import { getBroadcastMessageLintWarnings } from "~/features/broadcast/broadcast-message-lint";
import {
  parseRecipientInput,
  type ParsedRecipientRow,
} from "~/features/broadcast/broadcast-recipient-parse";
import { getBroadcastScheduleTimeLabel } from "~/features/broadcast/broadcast-schedule-label";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  addHours,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

const BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS = [
  0.25, 0.5, 1, 12, 24,
] as const;

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
}

function broadcastPrimaryActionLabel(
  busy: boolean,
  hasSchedule: boolean,
  scheduleTimeLabel: string | null
): string {
  if (busy) return hasSchedule ? "Scheduling…" : "Continue…";
  if (hasSchedule) {
    if (scheduleTimeLabel) return `Schedule for ${scheduleTimeLabel}`;
    return "Schedule";
  }
  return "Broadcast now";
}

/* eslint-disable sonarjs/cognitive-complexity -- audience builder coordinates many dependent fields */
export function BroadcastNewDraftForm({
  limits,
  planType,
  busy,
  actionError,
  savedAudiences,
  savedForNew,
  userTimezone,
}: BroadcastNewDraftFormProps) {
  const savedFiltered = useMemo(
    () => savedAudiences.filter((s) => s.audienceType !== "FOLLOWING"),
    [savedAudiences]
  );

  const allowGraph =
    limits.allowedAudienceTypes.includes("FOLLOWERS") ||
    limits.allowedAudienceTypes.includes("MUTUALS");
  const allowSaved = savedFiltered.length > 0;

  const [audienceTab, setAudienceTab] = useState<AudienceSourceTab>(() => {
    if (savedForNew) {
      return savedForNew.audienceType === "CUSTOM" ? "custom" : "saved";
    }
    if (limits.allowedAudienceTypes.includes("MUTUALS")) return "mutuals";
    if (limits.allowedAudienceTypes.includes("FOLLOWERS")) return "followers";
    return "custom";
  });

  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(
    () => savedForNew?.id ?? null
  );

  const [customRows, setCustomRows] = useState<ParsedRecipientRow[]>([]);
  const [validHexLines, setValidHexLines] = useState<string[]>([]);
  const [excludeMessagedDays, setExcludeMessagedDays] = useState(0);
  const [excludePriorBroadcastRecipients, setExcludePriorBroadcastRecipients] =
    useState(false);

  const [messageLen, setMessageLen] = useState(0);
  const [messageBody, setMessageBody] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("BEST_COMPATIBILITY");
  const [sendStrategy, setSendStrategy] = useState("STANDARD");
  const [scheduledForLocal, setScheduledForLocal] = useState("");

  const minDatetime = getNowForDateTimeLocal(userTimezone);
  const hasScheduleTimeForSubmit =
    limits.allowSchedule &&
    scheduledForLocal.trim() !== "" &&
    !Number.isNaN(new Date(scheduledForLocal).getTime());
  const scheduleTimeLabel = hasScheduleTimeForSubmit
    ? getBroadcastScheduleTimeLabel(scheduledForLocal)
    : null;
  const primaryLabel = broadcastPrimaryActionLabel(
    busy,
    hasScheduleTimeForSubmit,
    scheduleTimeLabel
  );

  const applyQuickSchedule = (hours: number) => {
    const min = getNowForDateTimeLocal(userTimezone);
    const now = nowInTimezone(userTimezone);
    const hoursLater = addHours(now, hours);
    const formatted = formatForDateTimeLocal(hoursLater, userTimezone);
    setScheduledForLocal(formatted < min ? min : formatted);
  };

  const resolvedSelectedSavedId = useMemo(() => {
    if (audienceTab !== "saved") return selectedSavedId;
    if (selectedSavedId) return selectedSavedId;
    return savedFiltered[0]?.id ?? null;
  }, [audienceTab, selectedSavedId, savedFiltered]);

  const selectedSaved = useMemo(
    () =>
      resolvedSelectedSavedId
        ? (savedFiltered.find((s) => s.id === resolvedSelectedSavedId) ?? null)
        : null,
    [savedFiltered, resolvedSelectedSavedId]
  );

  const effectiveAudienceType = useMemo(() => {
    if (audienceTab === "mutuals") return "MUTUALS" as const;
    if (audienceTab === "followers") return "FOLLOWERS" as const;
    if (audienceTab === "saved" && selectedSaved) {
      return selectedSaved.audienceType as "CUSTOM" | "FOLLOWERS" | "MUTUALS";
    }
    return "CUSTOM" as const;
  }, [audienceTab, selectedSaved]);

  const customPasteForPanel = useMemo(() => {
    if (audienceTab === "custom") {
      return savedForNew?.audienceType === "CUSTOM"
        ? savedForNew.customNpubLines.join("\n")
        : "";
    }
    if (audienceTab === "saved" && selectedSaved?.audienceType === "CUSTOM") {
      return selectedSaved.customNpubLines.join("\n");
    }
    return "";
  }, [audienceTab, savedForNew, selectedSaved]);

  const customPanelKey = useMemo(() => {
    if (audienceTab === "custom") {
      return `custom-${savedForNew?.id ?? "new"}`;
    }
    if (audienceTab === "saved" && selectedSavedId) {
      return `saved-custom-${selectedSavedId}`;
    }
    return "custom-off";
  }, [audienceTab, savedForNew?.id, selectedSavedId]);

  const hiddenCustomNpubs = useMemo(() => {
    if (audienceTab === "custom") {
      return validHexLines.join("\n");
    }
    if (audienceTab === "saved" && selectedSaved) {
      if (selectedSaved.audienceType === "CUSTOM") {
        return validHexLines.join("\n");
      }
      return selectedSaved.customNpubLines.join("\n");
    }
    return "";
  }, [audienceTab, selectedSaved, validHexLines]);

  const customSummary = useMemo(() => {
    const text = customRows.map((r) => r.raw).join("\n");
    return parseRecipientInput(text).summary;
  }, [customRows]);

  const parseSnapshotJson = useMemo(() => {
    const base = {
      version: 1 as const,
      sourceTab: audienceTab,
      savedAudienceId: audienceTab === "saved" ? selectedSavedId : undefined,
      savedAudienceName: selectedSaved?.name,
    };
    if (
      audienceTab === "custom" ||
      (audienceTab === "saved" && selectedSaved?.audienceType === "CUSTOM")
    ) {
      return JSON.stringify({
        ...base,
        summary: customSummary,
      });
    }
    return JSON.stringify(base);
  }, [
    audienceTab,
    selectedSavedId,
    selectedSaved?.name,
    selectedSaved?.audienceType,
    customSummary,
  ]);

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
    () => getBroadcastMessageLintWarnings(messageBody),
    [messageBody]
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

  const graphEstimateType = useMemo((): "FOLLOWERS" | "MUTUALS" | null => {
    if (audienceTab === "mutuals") return "MUTUALS";
    if (audienceTab === "followers") return "FOLLOWERS";
    if (
      audienceTab === "saved" &&
      selectedSaved &&
      (selectedSaved.audienceType === "FOLLOWERS" ||
        selectedSaved.audienceType === "MUTUALS")
    ) {
      return selectedSaved.audienceType === "MUTUALS" ? "MUTUALS" : "FOLLOWERS";
    }
    return null;
  }, [audienceTab, selectedSaved]);

  useEffect(() => {
    // Clear stale estimate when switching graph audience (mutuals vs followers vs saved).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when graph audience changes
    setGraphEstimateStats(null);
  }, [graphEstimateType]);

  const summaryAudienceSource = useMemo(() => {
    if (audienceTab === "saved") return "SAVED" as const;
    if (audienceTab === "mutuals") return "MUTUALS" as const;
    if (audienceTab === "followers") return "FOLLOWERS" as const;
    return "CUSTOM" as const;
  }, [audienceTab]);

  const canContinue = useMemo(() => {
    if (!messageBody.trim()) return false;
    if (audienceTab === "custom") return validHexLines.length > 0;
    if (audienceTab === "saved") {
      if (!selectedSaved) return false;
      if (selectedSaved.audienceType === "CUSTOM") {
        return validHexLines.length > 0;
      }
      return true;
    }
    return true;
  }, [audienceTab, messageBody, selectedSaved, validHexLines.length]);

  const canSaveAudience = useMemo(() => {
    if (!messageBody.trim()) return false;
    return canContinue;
  }, [canContinue, messageBody]);

  const showCustomMetrics = useMemo(
    () =>
      audienceTab === "custom" ||
      (audienceTab === "saved" && selectedSaved?.audienceType === "CUSTOM"),
    [audienceTab, selectedSaved?.audienceType]
  );

  return (
    <Form
      method="post"
      key={savedForNew?.id ?? "new-draft"}
      className="grid gap-8 lg:grid-cols-[1fr_minmax(260px,320px)]"
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

      <div className="space-y-4">
        {actionError ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {actionError}
          </div>
        ) : null}

        <AudienceSourceSelector
          value={audienceTab}
          onChange={setAudienceTab}
          disabled={busy}
          allowGraph={allowGraph}
          allowSaved={allowSaved}
        />

        {audienceTab === "mutuals" && allowGraph ? (
          <AudienceGraphPanel
            type="MUTUALS"
            onEstimateStats={onGraphEstimateStats}
          />
        ) : null}
        {audienceTab === "followers" && allowGraph ? (
          <AudienceGraphPanel
            type="FOLLOWERS"
            onEstimateStats={onGraphEstimateStats}
          />
        ) : null}

        {audienceTab === "saved" && selectedSaved ? (
          <div className="border-border space-y-3 rounded-lg border p-4">
            <div>
              <label
                htmlFor="broadcast-saved-pick"
                className="mb-1 block text-sm font-medium"
              >
                Saved audience
              </label>
              <select
                id="broadcast-saved-pick"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={resolvedSelectedSavedId ?? ""}
                onChange={(e) => {
                  setSelectedSavedId(e.target.value || null);
                }}
              >
                {savedFiltered.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-muted-foreground text-xs">
              Type: {selectedSaved.audienceType}
              {selectedSaved.lastResolvedSize != null
                ? ` · last estimate ${String(selectedSaved.lastResolvedSize)}`
                : null}
            </p>
            {(selectedSaved.audienceType === "FOLLOWERS" ||
              selectedSaved.audienceType === "MUTUALS") &&
            allowGraph ? (
              <AudienceGraphPanel
                type={
                  selectedSaved.audienceType === "MUTUALS"
                    ? "MUTUALS"
                    : "FOLLOWERS"
                }
                onEstimateStats={onGraphEstimateStats}
              />
            ) : null}
          </div>
        ) : null}

        {audienceTab === "custom" ||
        (audienceTab === "saved" &&
          selectedSaved?.audienceType === "CUSTOM") ? (
          <AudiencePanelCustomList
            key={customPanelKey}
            savedAudiences={savedFiltered}
            initialPaste={customPasteForPanel}
            onRowsChange={setCustomRows}
            onValidHexLinesChange={setValidHexLines}
          />
        ) : null}

        <div className="border-border space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Audience exclusions</p>
          <p className="text-muted-foreground text-xs">
            Applied when you resolve the audience (after suppression and
            self-exclusion).
          </p>
          <div>
            <label
              htmlFor="broadcast-exclude-recent-days-global"
              className="text-muted-foreground text-xs font-medium"
            >
              Exclude recipients you messaged in the last
            </label>
            <select
              id="broadcast-exclude-recent-days-global"
              className="border-input bg-background mt-1 block w-full max-w-xs rounded-md border px-3 py-2 text-sm"
              value={String(excludeMessagedDays)}
              onChange={(e) => {
                setExcludeMessagedDays(Number(e.target.value));
              }}
            >
              <option value="0">No extra exclusion</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="border-input mt-0.5 rounded"
              checked={excludePriorBroadcastRecipients}
              onChange={(e) => {
                setExcludePriorBroadcastRecipients(e.target.checked);
              }}
            />
            <span>
              Exclude anyone who already received a prior broadcast from this
              account (any completed send).
            </span>
          </label>
        </div>

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
              value={sendStrategy}
              onChange={(e) => setSendStrategy(e.target.value)}
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
          <div className="space-y-2">
            <label
              htmlFor="broadcast-scheduled-for"
              className="mb-1 block text-sm font-medium"
            >
              Schedule for later
            </label>
            <input
              id="broadcast-scheduled-for"
              type="datetime-local"
              name="scheduledFor"
              value={scheduledForLocal}
              min={minDatetime}
              onChange={(e) => {
                const v = e.target.value;
                const min = getNowForDateTimeLocal(userTimezone);
                setScheduledForLocal(v && v < min ? min : v);
              }}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS.map((h) => (
                <Button
                  key={h}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    applyQuickSchedule(h);
                  }}
                  className="border-primary text-foreground hover:bg-muted transition-transform duration-150 active:scale-95"
                >
                  {formatIntervalLabel(h, { compact: true })}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Leave scheduling empty to{" "}
          <strong className="text-foreground">broadcast now</strong>, or pick a
          time to <strong className="text-foreground">schedule</strong>. Both
          paths resolve the audience and open mandatory review before signing.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            name="intent"
            value="create_draft"
            disabled={busy || !canContinue}
            className="border-input bg-background hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="submit"
            name="intent"
            value="save_audience"
            disabled={busy || !canSaveAudience}
            className="border-input bg-background hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Save audience
          </button>
          <button
            type="submit"
            name="intent"
            value={hasScheduleTimeForSubmit ? "create_schedule" : "create_now"}
            disabled={busy || !canContinue}
            className="bg-success hover:bg-success/90 inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {hasScheduleTimeForSubmit ? (
              <Clock
                className="h-5 w-5 shrink-0"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            ) : (
              <Send
                className="h-5 w-5 shrink-0"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            )}
            {primaryLabel}
          </button>
        </div>
      </div>

      <AudienceSummaryCard
        planType={planType}
        limits={{
          maxRecipientsPerCampaign: limits.maxRecipientsPerCampaign,
          maxDailyBroadcastRecipients: limits.maxDailyBroadcastRecipients,
        }}
        audienceSource={summaryAudienceSource}
        parsed={showCustomMetrics ? customSummary.parsed : undefined}
        valid={showCustomMetrics ? customSummary.valid : undefined}
        duplicates={showCustomMetrics ? customSummary.duplicates : undefined}
        invalid={showCustomMetrics ? customSummary.invalid : undefined}
        finalSendable={
          showCustomMetrics ? customSummary.finalSendable : undefined
        }
        estimatedGraphCount={
          graphEstimateType ? (graphEstimateStats?.count ?? null) : null
        }
        graphFetchFailed={
          graphEstimateType ? (graphEstimateStats?.fetchFailed ?? false) : false
        }
        deliveryMode={deliveryMode as BroadcastDeliveryMode}
        sendStrategy={sendStrategy}
        scheduleLabel={scheduleTimeLabel}
        broadcastNowLabel={!hasScheduleTimeForSubmit}
        excludeRecentDays={excludeMessagedDays}
        overlapWarning={null}
      />
    </Form>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
