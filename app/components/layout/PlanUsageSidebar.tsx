import { Link, useRouteLoaderData } from "@remix-run/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

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

function textClass(state: ReturnType<typeof meterVisualState>): string {
  switch (state) {
    case "error":
      return "text-destructive";
    case "strong":
      return "text-amber-800 dark:text-amber-200";
    case "warn":
      return "text-amber-800/90 dark:text-amber-200/90";
    default:
      return "text-text-tertiary";
  }
}

function UsageTextLine({
  used,
  limit,
  suffix,
}: {
  used: number;
  limit: number | null;
  suffix: string;
}) {
  const ratio = usageRatio(used, limit);
  const state = meterVisualState(ratio);
  return (
    <p className={cn("text-sm leading-snug tabular-nums", textClass(state))}>
      {limit == null ? (
        <>
          {used} <span className="font-normal">{suffix}</span>
        </>
      ) : (
        <>
          {used}
          <span className="text-text-tertiary/90"> / </span>
          {limit}
          <span className="font-normal"> {suffix}</span>
        </>
      )}
    </p>
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

  const usageStack = (
    <div className="flex flex-col gap-1">
      <p className="text-text-secondary text-sm leading-snug font-medium">
        {snapshot.planDisplayName}
      </p>
      <UsageTextLine
        used={snapshot.scheduledUsed}
        limit={snapshot.scheduledLimit}
        suffix="scheduled"
      />
      {showAccountsRow(snapshot) ? (
        <UsageTextLine
          used={snapshot.accountsUsed ?? 0}
          limit={snapshot.accountsLimit}
          suffix="accounts"
        />
      ) : null}
      <UsageTextLine
        used={snapshot.queuesUsed}
        limit={snapshot.queuesLimit}
        suffix="queues"
      />
      {expanded && canExpand ? (
        <p className="text-text-tertiary text-sm leading-snug tabular-nums">
          {snapshot.storageUsedBytes != null &&
          snapshot.storageLimitBytes != null ? (
            <>
              SFS storage:{" "}
              {snapshot.storageUsedBytes <= 0
                ? "0 B"
                : formatBytesForPlanMarketing(snapshot.storageUsedBytes)}
              <span className="text-text-tertiary/90"> / </span>
              {formatBytesForPlanMarketing(snapshot.storageLimitBytes)}
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full shrink-0 flex-col gap-2 px-2.5",
        "hidden max-lg:block",
        isDesktopExpanded ? "lg:block" : "lg:hidden"
      )}
    >
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
          className="text-text-tertiary hover:text-text-secondary focus-ring flex w-full items-start justify-between gap-2 rounded-lg text-left"
        >
          <div className="min-w-0 flex-1">{usageStack}</div>
          <span className="text-text-tertiary inline-flex shrink-0 self-start pt-0.5">
            {expanded ? (
              <ChevronUp className="size-4" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronDown className="size-4" strokeWidth={2} aria-hidden />
            )}
          </span>
        </button>
      ) : (
        usageStack
      )}

      {snapshot.subscriptionExpiredForUi ? (
        <p className="text-text-tertiary text-sm leading-snug">
          Subscription expired
        </p>
      ) : null}

      {showPlanFooterLink ? (
        <div>
          <Link
            to="/plans"
            onClick={() => onMobileNavActiveClick?.()}
            className="text-text-tertiary hover:text-text focus-ring inline-block text-sm font-medium underline-offset-2 hover:underline"
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
  );
}
