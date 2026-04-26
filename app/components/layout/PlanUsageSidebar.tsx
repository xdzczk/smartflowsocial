import { Link, useRouteLoaderData } from "@remix-run/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { formatBytesForPlanMarketing } from "~/features/payments/limit-display";
import type { PlanUsageSnapshot } from "~/features/payments/plan-usage.types";
import { cn } from "~/lib/utils";

const PLAN_USAGE_EXPANDED_LS_KEY = "sfs:dashboard-plan-usage-expanded";

/** Match sidebar nav icons (DashboardHeader). */
const SIDEBAR_CHEVRON_STROKE = 2.25;

function usageRatio(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return used / limit;
}

function meterVisualState(
  ratio: number | null
): "neutral" | "warn" | "strong" | "error" {
  if (ratio == null) return "neutral";
  if (ratio > 1) return "error";
  if (ratio >= 0.9) return "strong";
  if (ratio >= 0.7) return "warn";
  return "neutral";
}

function textClass(state: ReturnType<typeof meterVisualState>): string {
  switch (state) {
    case "error":
      return "text-destructive";
    case "strong":
      return "text-amber-800 dark:text-amber-200";
    case "warn":
      return "text-amber-800/90 dark:text-amber-200/90";
    default:
      return "text-text-secondary";
  }
}

function labelClass(state: ReturnType<typeof meterVisualState>): string {
  switch (state) {
    case "error":
      return "text-destructive/80";
    case "strong":
    case "warn":
      return "text-amber-800/75 dark:text-amber-200/80";
    default:
      return "text-text-tertiary";
  }
}

/** Thin meter fill — low contrast unless warn/error. */
function meterFillClass(state: ReturnType<typeof meterVisualState>): string {
  switch (state) {
    case "error":
      return "bg-destructive/75";
    case "strong":
      return "bg-amber-600/45 dark:bg-amber-500/45";
    case "warn":
      return "bg-amber-600/35 dark:bg-amber-500/35";
    default:
      return "bg-text-tertiary/28";
  }
}

function showAccountsRow(snapshot: PlanUsageSnapshot): boolean {
  return (
    snapshot.accountsUsed != null &&
    snapshot.accountsLimit != null &&
    snapshot.accountsLimit > 1
  );
}

function hasHardLimit(snapshot: PlanUsageSnapshot): boolean {
  const candidates: Array<number | null> = [
    usageRatio(snapshot.scheduledUsed, snapshot.scheduledLimit),
    usageRatio(snapshot.queuesUsed, snapshot.queuesLimit),
  ];
  if (showAccountsRow(snapshot)) {
    candidates.push(
      usageRatio(snapshot.accountsUsed ?? 0, snapshot.accountsLimit)
    );
  }
  if (
    snapshot.storageUsedBytes != null &&
    snapshot.storageLimitBytes != null &&
    snapshot.storageLimitBytes > 0
  ) {
    candidates.push(
      usageRatio(snapshot.storageUsedBytes, snapshot.storageLimitBytes)
    );
  }
  return candidates.some((r) => r != null && r > 1);
}

function shouldAutoExpand(snapshot: PlanUsageSnapshot): boolean {
  return snapshot.subscriptionExpiredForUi || hasHardLimit(snapshot);
}

/** Collapsed hides queues/storage; expanded always adds value for decision-making. */
function hasExpandableDetail(_snapshot: PlanUsageSnapshot): boolean {
  return true;
}

function computeShowCalmViewPlans(snapshot: PlanUsageSnapshot): boolean {
  if (snapshot.effectivePlanType === "founder") return false;
  if (snapshot.subscriptionExpiredForUi) return false;
  if (hasHardLimit(snapshot)) return false;
  return (
    snapshot.effectivePlanType === "free" ||
    snapshot.effectivePlanType === "starter"
  );
}

function anyNearLimit(snapshot: PlanUsageSnapshot): boolean {
  const candidates: Array<number | null> = [
    usageRatio(snapshot.scheduledUsed, snapshot.scheduledLimit),
    usageRatio(snapshot.queuesUsed, snapshot.queuesLimit),
  ];
  if (showAccountsRow(snapshot)) {
    candidates.push(
      usageRatio(snapshot.accountsUsed ?? 0, snapshot.accountsLimit)
    );
  }
  if (
    snapshot.storageUsedBytes != null &&
    snapshot.storageLimitBytes != null &&
    snapshot.storageLimitBytes > 0
  ) {
    candidates.push(
      usageRatio(snapshot.storageUsedBytes, snapshot.storageLimitBytes)
    );
  }
  return candidates.some((r) => r != null && r > 0.8 && r <= 1);
}

function MetricNumbers({
  used,
  limit,
  unitLabel,
}: {
  used: number;
  limit: number | null;
  unitLabel: string;
}) {
  const ratio = usageRatio(used, limit);
  const state = meterVisualState(ratio);
  const showBar = ratio != null;
  const pct = ratio == null ? 0 : ratio <= 1 ? Math.min(100, ratio * 100) : 100;
  const fillWidthPct =
    showBar && pct <= 0 && limit != null && limit > 0 ? 2 : pct;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs leading-snug">
        <span
          className={cn(
            "font-medium tracking-tight tabular-nums",
            textClass(state)
          )}
        >
          {limit == null ? (
            <>
              {used}
              <span
                className={cn("text-[11px] font-normal", labelClass(state))}
              >
                {" "}
                {unitLabel}
              </span>
            </>
          ) : (
            <>
              {used}
              <span className="text-text-tertiary/85 text-[11px] font-normal">
                {" "}
                /{" "}
              </span>
              {limit}
              <span
                className={cn("text-[11px] font-normal", labelClass(state))}
              >
                {" "}
                {unitLabel}
              </span>
            </>
          )}
        </span>
      </p>
      {showBar ? (
        <div
          className="bg-border-subtle/35 dark:bg-border-subtle/25 h-px w-full overflow-hidden rounded-full"
          aria-hidden
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              meterFillClass(state),
              pct <= 0 && limit != null && limit > 0 && "min-w-px"
            )}
            style={{ width: `${fillWidthPct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

const sectionHeadingClass =
  "text-text-tertiary/90 text-[11px] font-medium tracking-wide uppercase";

function StorageBlock({
  usedBytes,
  limitBytes,
}: {
  usedBytes: number;
  limitBytes: number;
}) {
  const ratio = usageRatio(usedBytes, limitBytes);
  const state = meterVisualState(ratio);
  const pct = ratio == null ? 0 : ratio <= 1 ? Math.min(100, ratio * 100) : 100;
  const fillWidthPct = ratio != null && pct <= 0 && limitBytes > 0 ? 2 : pct;

  return (
    <div className="mt-3 flex flex-col gap-1">
      <p className={sectionHeadingClass}>Storage</p>
      <p className="text-xs leading-snug">
        <span
          className={cn(
            "font-medium tracking-tight tabular-nums",
            textClass(state)
          )}
        >
          {usedBytes <= 0 ? "0 B" : formatBytesForPlanMarketing(usedBytes)}
          <span className="text-text-tertiary/85 text-[11px] font-normal">
            {" "}
            /{" "}
          </span>
          {formatBytesForPlanMarketing(limitBytes)}
        </span>
      </p>
      {ratio != null ? (
        <div
          className="bg-border-subtle/35 dark:bg-border-subtle/25 h-px w-full overflow-hidden rounded-full"
          aria-hidden
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              meterFillClass(state),
              pct <= 0 && limitBytes > 0 && "min-w-px"
            )}
            style={{ width: `${fillWidthPct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

const linkClass =
  "text-text-secondary hover:text-text focus-ring inline-flex text-xs font-medium underline-offset-2 hover:underline";

const LABEL_SCHEDULED = "scheduled";
const COPY_ALMOST_FULL = "Almost full";
const CTA_UPGRADE_CONTINUE = "Upgrade to continue →";
const CTA_START_SCHEDULING = "Start scheduling →";
const CTA_RESTORE_PLAN = "Restore plan →";

function PlanUsageCollapsedSmart({
  snapshot,
  nearAny,
  anyHard,
  scheduledEmpty,
  onMobileNavActiveClick,
}: {
  snapshot: PlanUsageSnapshot;
  nearAny: boolean;
  anyHard: boolean;
  scheduledEmpty: boolean;
  onMobileNavActiveClick?: () => void;
}) {
  return (
    <>
      {!snapshot.subscriptionExpiredForUi && nearAny && !anyHard ? (
        <p className="text-xs leading-normal font-medium text-amber-800/90 dark:text-amber-200/85">
          {COPY_ALMOST_FULL}
        </p>
      ) : null}
      {anyHard && !snapshot.subscriptionExpiredForUi ? (
        <Link
          to="/plans"
          onClick={() => onMobileNavActiveClick?.()}
          className={linkClass}
        >
          {CTA_UPGRADE_CONTINUE}
        </Link>
      ) : null}
      {scheduledEmpty && !anyHard && !snapshot.subscriptionExpiredForUi ? (
        <Link
          to="/dashboard/scheduled"
          onClick={() => onMobileNavActiveClick?.()}
          className={linkClass}
        >
          {CTA_START_SCHEDULING}
        </Link>
      ) : null}
      {snapshot.subscriptionExpiredForUi ? (
        <Link
          to="/plans"
          onClick={() => onMobileNavActiveClick?.()}
          className={linkClass}
        >
          {CTA_RESTORE_PLAN}
        </Link>
      ) : null}
    </>
  );
}

function PlanUsageExpandedSmart({
  snapshot,
  nearAny,
  anyHard,
  scheduledEmpty,
  showCalmViewPlans,
  onMobileNavActiveClick,
}: {
  snapshot: PlanUsageSnapshot;
  nearAny: boolean;
  anyHard: boolean;
  scheduledEmpty: boolean;
  showCalmViewPlans: boolean;
  onMobileNavActiveClick?: () => void;
}) {
  return (
    <>
      {!snapshot.subscriptionExpiredForUi && nearAny && !anyHard ? (
        <p className="text-xs leading-normal font-medium text-amber-800/90 dark:text-amber-200/85">
          {COPY_ALMOST_FULL}
        </p>
      ) : null}
      {anyHard && !snapshot.subscriptionExpiredForUi ? (
        <Link
          to="/plans"
          onClick={() => onMobileNavActiveClick?.()}
          className={cn(linkClass, "mt-0.5")}
        >
          {CTA_UPGRADE_CONTINUE}
        </Link>
      ) : null}
      {scheduledEmpty && !anyHard && !snapshot.subscriptionExpiredForUi ? (
        <Link
          to="/dashboard/scheduled"
          onClick={() => onMobileNavActiveClick?.()}
          className={cn(linkClass, "mt-0.5")}
        >
          {CTA_START_SCHEDULING}
        </Link>
      ) : null}
      {showCalmViewPlans &&
      !scheduledEmpty &&
      !anyHard &&
      !snapshot.subscriptionExpiredForUi ? (
        <Link
          to="/plans"
          onClick={() => onMobileNavActiveClick?.()}
          className={cn(linkClass, "mt-1.5")}
        >
          View plans
        </Link>
      ) : null}
    </>
  );
}

function PlanUsageExpandedBody({
  snapshot,
  onMobileNavActiveClick,
}: {
  snapshot: PlanUsageSnapshot;
  onMobileNavActiveClick?: () => void;
}) {
  return (
    <>
      <div className="mt-2 flex flex-col gap-1.5">
        <p className={sectionHeadingClass}>Scheduling</p>
        <MetricNumbers
          used={snapshot.scheduledUsed}
          limit={snapshot.scheduledLimit}
          unitLabel={LABEL_SCHEDULED}
        />
        {showAccountsRow(snapshot) ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className={sectionHeadingClass}>Accounts</p>
            <MetricNumbers
              used={snapshot.accountsUsed ?? 0}
              limit={snapshot.accountsLimit}
              unitLabel="accounts"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <p className={sectionHeadingClass}>Queues</p>
        <MetricNumbers
          used={snapshot.queuesUsed}
          limit={snapshot.queuesLimit}
          unitLabel="queues"
        />
      </div>

      {snapshot.storageLimitBytes != null &&
      snapshot.storageUsedBytes != null ? (
        <StorageBlock
          usedBytes={snapshot.storageUsedBytes}
          limitBytes={snapshot.storageLimitBytes}
        />
      ) : null}

      {snapshot.subscriptionExpiredForUi ? (
        <div className="border-border-subtle/40 dark:border-border-subtle/25 mt-3 border-t pt-2.5">
          <p className={sectionHeadingClass}>Subscription</p>
          <p className="text-text-secondary mt-1 text-xs leading-snug font-medium">
            Your subscription has expired
          </p>
          <Link
            to="/plans"
            onClick={() => onMobileNavActiveClick?.()}
            className={cn(linkClass, "mt-1.5")}
          >
            {CTA_RESTORE_PLAN}
          </Link>
        </div>
      ) : null}
    </>
  );
}

export interface PlanUsageSidebarProps {
  isDesktopExpanded: boolean;
  onMobileNavActiveClick?: () => void;
}

export function PlanUsageSidebar({
  isDesktopExpanded,
  onMobileNavActiveClick,
}: PlanUsageSidebarProps) {
  const raw = useRouteLoaderData("routes/dashboard") as
    | { planUsage?: PlanUsageSnapshot }
    | undefined;
  const snapshot = raw?.planUsage;

  const autoExpand = snapshot ? shouldAutoExpand(snapshot) : false;
  const expandable = snapshot ? hasExpandableDetail(snapshot) : false;

  const [userExpanded, setUserExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(PLAN_USAGE_EXPANDED_LS_KEY) === "true";
    } catch {
      return false;
    }
  });

  /** Auto-expand overrides collapsed preference until the situation clears. */
  const expanded = autoExpand || userExpanded;

  const toggleExpanded = useCallback(() => {
    if (autoExpand) return;
    setUserExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PLAN_USAGE_EXPANDED_LS_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [autoExpand]);

  const scheduledRatio = snapshot
    ? usageRatio(snapshot.scheduledUsed, snapshot.scheduledLimit)
    : null;
  const scheduledEmpty =
    snapshot != null &&
    !snapshot.subscriptionExpiredForUi &&
    snapshot.scheduledUsed === 0;

  const showCalmViewPlans = snapshot
    ? computeShowCalmViewPlans(snapshot)
    : false;
  const anyHard = snapshot ? hasHardLimit(snapshot) : false;

  const collapsedMain = useMemo(() => {
    if (!snapshot) {
      return null;
    }
    if (snapshot.subscriptionExpiredForUi) {
      return (
        <p className="text-text-secondary text-xs leading-snug font-medium">
          Subscription expired
        </p>
      );
    }
    const state = meterVisualState(scheduledRatio);
    return (
      <p className="text-xs leading-snug">
        <span
          className={cn(
            "font-medium tracking-tight tabular-nums",
            textClass(state)
          )}
        >
          {snapshot.scheduledLimit == null ? (
            <>
              {snapshot.scheduledUsed}
              <span
                className={cn("text-[11px] font-normal", labelClass(state))}
              >
                {" "}
                {LABEL_SCHEDULED}
              </span>
            </>
          ) : (
            <>
              {snapshot.scheduledUsed}
              <span className="text-text-tertiary/85 text-[11px] font-normal">
                {" "}
                /{" "}
              </span>
              {snapshot.scheduledLimit}
              <span
                className={cn("text-[11px] font-normal", labelClass(state))}
              >
                {" "}
                {LABEL_SCHEDULED}
              </span>
            </>
          )}
        </span>
      </p>
    );
  }, [snapshot, scheduledRatio]);

  if (!snapshot) {
    return null;
  }

  const nearAny = anyNearLimit(snapshot);

  const showChevron = expandable && !autoExpand;

  return (
    <div
      className={cn(
        "flex w-full shrink-0 flex-col gap-1.5 px-2.5",
        "hidden max-lg:block",
        isDesktopExpanded ? "lg:block" : "lg:hidden"
      )}
    >
      <p className="text-text-secondary text-xs leading-snug font-medium">
        {snapshot.planDisplayName}
      </p>

      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded ? "Hide plan usage details" : "Show plan usage details"
          }
          onClick={toggleExpanded}
          disabled={autoExpand}
          className={cn(
            "focus-ring flex w-full items-start gap-2 rounded-lg text-left",
            autoExpand
              ? "cursor-default"
              : "text-text-tertiary hover:text-text-secondary"
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {expanded ? (
              <>
                <PlanUsageExpandedBody
                  snapshot={snapshot}
                  onMobileNavActiveClick={onMobileNavActiveClick}
                />
                <PlanUsageExpandedSmart
                  snapshot={snapshot}
                  nearAny={nearAny}
                  anyHard={anyHard}
                  scheduledEmpty={scheduledEmpty}
                  showCalmViewPlans={showCalmViewPlans}
                  onMobileNavActiveClick={onMobileNavActiveClick}
                />
              </>
            ) : (
              <>
                {collapsedMain}
                <PlanUsageCollapsedSmart
                  snapshot={snapshot}
                  nearAny={nearAny}
                  anyHard={anyHard}
                  scheduledEmpty={scheduledEmpty}
                  onMobileNavActiveClick={onMobileNavActiveClick}
                />
              </>
            )}
          </div>
          {showChevron ? (
            <span className="text-text-tertiary inline-flex shrink-0 self-start pt-px">
              {expanded ? (
                <ChevronUp
                  className="size-4"
                  strokeWidth={SIDEBAR_CHEVRON_STROKE}
                  aria-hidden
                />
              ) : (
                <ChevronDown
                  className="size-4"
                  strokeWidth={SIDEBAR_CHEVRON_STROKE}
                  aria-hidden
                />
              )}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          {collapsedMain}
          <PlanUsageCollapsedSmart
            snapshot={snapshot}
            nearAny={nearAny}
            anyHard={anyHard}
            scheduledEmpty={scheduledEmpty}
            onMobileNavActiveClick={onMobileNavActiveClick}
          />
        </div>
      )}
    </div>
  );
}
