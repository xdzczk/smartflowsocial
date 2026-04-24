import { Link, useRouteLoaderData } from "@remix-run/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

import { SIDEBAR_UTILITY_CARD_CLASS } from "~/components/layout/sidebar-utility-styles";
import { formatBytesForPlanMarketing } from "~/features/payments/limit-display";
import type { PlanUsageSnapshot } from "~/features/payments/plan-usage.types";
import { cn } from "~/lib/utils";

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

function fillClass(state: ReturnType<typeof meterVisualState>): string {
  switch (state) {
    case "error":
      return "bg-destructive";
    case "strong":
      return "bg-amber-600 dark:bg-amber-500";
    case "warn":
      return "bg-amber-500/80 dark:bg-amber-500/70";
    default:
      return "bg-text-secondary/25";
  }
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

function UsageLine({
  label,
  used,
  limit,
  hideMeterWhenZeroUsage = false,
}: {
  label: string;
  used: number;
  limit: number | null;
  /** When true and usage is 0 with a finite cap, omit the bar (numbers stay). */
  hideMeterWhenZeroUsage?: boolean;
}) {
  const ratio = usageRatio(used, limit);
  const state = meterVisualState(ratio);
  const pct = ratio == null ? 0 : ratio <= 1 ? Math.min(100, ratio * 100) : 100;
  const showMeter = ratio != null;
  const fillWidthPct =
    showMeter && pct <= 0 && limit != null && limit > 0 ? 2 : pct;
  const hideZeroBar =
    hideMeterWhenZeroUsage &&
    used === 0 &&
    limit != null &&
    limit > 0 &&
    ratio != null;
  const showMeterBar = showMeter && !hideZeroBar;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-secondary text-[10px] font-medium tracking-tight">
          {label}
        </span>
        <span
          className={cn(
            "text-[10px] tracking-tight tabular-nums",
            textClass(state)
          )}
        >
          {limit == null ? (
            <>
              {used}
              <span className="text-text-tertiary"> · </span>
              <span className="text-text-tertiary font-normal">Unlimited</span>
            </>
          ) : (
            <>
              {used}
              <span className="text-text-tertiary"> / </span>
              {limit}
            </>
          )}
        </span>
      </div>
      {showMeterBar ? (
        <div className="bg-surface-selected/80 h-0.5 w-full overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              fillClass(state),
              pct <= 0 && limit != null && limit > 0 && "min-w-[3px]"
            )}
            style={{ width: `${fillWidthPct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StorageLine({
  usedBytes,
  limitBytes,
}: {
  usedBytes: number;
  limitBytes: number;
}) {
  const ratio = usageRatio(usedBytes, limitBytes);
  const state = meterVisualState(ratio);
  const pct = ratio == null ? 0 : ratio <= 1 ? Math.min(100, ratio * 100) : 100;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-secondary text-[10px] font-medium tracking-tight">
          SFS storage
        </span>
        <span
          className={cn(
            "text-[10px] tracking-tight tabular-nums",
            textClass(state)
          )}
        >
          {usedBytes <= 0 ? "0 B" : formatBytesForPlanMarketing(usedBytes)}
          <span className="text-text-tertiary"> / </span>
          {formatBytesForPlanMarketing(limitBytes)}
        </span>
      </div>
      <div className="bg-surface-selected/80 h-0.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            fillClass(state),
            pct <= 0 && "min-w-[3px]"
          )}
          style={{ width: `${pct <= 0 ? 2 : pct}%` }}
        />
      </div>
    </div>
  );
}

function showAccountsRow(snapshot: PlanUsageSnapshot): boolean {
  return (
    snapshot.accountsUsed != null &&
    snapshot.accountsLimit != null &&
    snapshot.accountsLimit > 1
  );
}

/** Expand only when storage (and optional extra detail) is not already in the main column. */
function planUsageHasExpandableExtra(snapshot: PlanUsageSnapshot): boolean {
  return (
    snapshot.storageLimitBytes != null && snapshot.storageUsedBytes != null
  );
}

function computeShowUpgradeCta(snapshot: PlanUsageSnapshot): boolean {
  if (snapshot.effectivePlanType === "founder") {
    return false;
  }

  const candidates: Array<number | null> = [
    usageRatio(snapshot.scheduledUsed, snapshot.scheduledLimit),
  ];
  if (showAccountsRow(snapshot)) {
    candidates.push(
      usageRatio(snapshot.accountsUsed ?? 0, snapshot.accountsLimit)
    );
  }
  candidates.push(usageRatio(snapshot.queuesUsed, snapshot.queuesLimit));
  if (snapshot.storageUsedBytes != null && snapshot.storageLimitBytes != null) {
    candidates.push(
      usageRatio(snapshot.storageUsedBytes, snapshot.storageLimitBytes)
    );
  }

  let worst: number | null = null;
  for (const r of candidates) {
    if (r == null) continue;
    worst = worst == null ? r : Math.max(worst, r);
  }

  if (snapshot.subscriptionExpiredForUi) {
    return false;
  }

  if (worst != null && worst > 1) return true;
  if (worst != null && worst >= 0.7) return true;

  if (
    (snapshot.effectivePlanType === "free" ||
      snapshot.effectivePlanType === "starter") &&
    worst != null &&
    worst >= 0.5
  ) {
    return true;
  }

  return false;
}

export interface PlanUsageSidebarProps {
  isDesktopExpanded: boolean;
  onMobileNavActiveClick?: () => void;
}

export function PlanUsageSidebar({
  isDesktopExpanded,
  onMobileNavActiveClick,
}: PlanUsageSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const raw = useRouteLoaderData("routes/dashboard") as
    | { planUsage?: PlanUsageSnapshot }
    | undefined;
  const snapshot = raw?.planUsage;

  const showUpgrade = snapshot ? computeShowUpgradeCta(snapshot) : false;
  const showCalmViewPlans =
    snapshot?.effectivePlanType === "free" &&
    !snapshot.subscriptionExpiredForUi &&
    !showUpgrade;
  const showPlanFooterLink =
    snapshot != null &&
    (snapshot.subscriptionExpiredForUi || showUpgrade || showCalmViewPlans);
  const canExpand = snapshot != null && planUsageHasExpandableExtra(snapshot);

  useEffect(() => {
    if (!canExpand && expanded) {
      queueMicrotask(() => setExpanded(false));
    }
  }, [canExpand, expanded]);

  if (!snapshot) {
    return null;
  }

  const headerInner = (
    <div className="flex min-w-0 items-baseline gap-1.5 pr-1">
      <span className="text-text shrink-0 text-[11px] font-semibold tracking-tight">
        Plan usage
      </span>
      <span className="text-text-tertiary shrink-0 text-[10px]" aria-hidden>
        ·
      </span>
      <span className="text-text-secondary min-w-0 truncate text-[10px] leading-snug">
        {snapshot.planDisplayName}
      </span>
    </div>
  );

  return (
    <div
      className={cn(
        "w-full shrink-0",
        "hidden max-lg:block",
        isDesktopExpanded ? "lg:block" : "lg:hidden"
      )}
    >
      <div className={SIDEBAR_UTILITY_CARD_CLASS}>
        {canExpand ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? "Hide extra plan usage rows"
                : "Show extra plan usage rows"
            }
            onClick={() => setExpanded((v) => !v)}
            className="text-text hover:bg-surface-hover/80 focus-ring flex w-full items-center justify-between gap-2 rounded-md px-0.5 py-0.5 text-left"
          >
            {headerInner}
            <span className="text-text-tertiary inline-flex shrink-0">
              {expanded ? (
                <ChevronUp className="size-3.5" strokeWidth={2} aria-hidden />
              ) : (
                <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
              )}
            </span>
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 px-0.5 py-0.5">
            {headerInner}
          </div>
        )}

        <div className="mt-2 space-y-2">
          <UsageLine
            label="Scheduled"
            used={snapshot.scheduledUsed}
            limit={snapshot.scheduledLimit}
            hideMeterWhenZeroUsage={!expanded}
          />
          {showAccountsRow(snapshot) ? (
            <UsageLine
              label="Accounts"
              used={snapshot.accountsUsed ?? 0}
              limit={snapshot.accountsLimit}
              hideMeterWhenZeroUsage={!expanded}
            />
          ) : null}
          <UsageLine
            label="Queues"
            used={snapshot.queuesUsed}
            limit={snapshot.queuesLimit}
            hideMeterWhenZeroUsage={!expanded}
          />

          {expanded && canExpand ? (
            <div className="border-border-subtle border-t pt-2">
              {snapshot.storageLimitBytes != null &&
              snapshot.storageUsedBytes != null ? (
                <StorageLine
                  usedBytes={snapshot.storageUsedBytes}
                  limitBytes={snapshot.storageLimitBytes}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {snapshot.subscriptionExpiredForUi ? (
          <p className="text-text-tertiary mt-2 text-[10px] leading-snug">
            Subscription expired
          </p>
        ) : null}

        {showPlanFooterLink ? (
          <div className="border-border-subtle mt-2 border-t pt-2">
            <Link
              to="/plans"
              onClick={() => onMobileNavActiveClick?.()}
              className="text-text-tertiary hover:text-text focus-ring inline-block text-[10px] font-medium underline-offset-2 hover:underline"
            >
              {snapshot.subscriptionExpiredForUi
                ? "Restore plan"
                : showUpgrade
                  ? "Upgrade plan"
                  : "View plans"}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
