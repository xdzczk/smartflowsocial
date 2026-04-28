import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { RAIL_SECONDARY_ACTION } from "./tokens";

export function ActionRailActions({
  secondaryLabel,
  onSecondaryClick,
  secondaryDisabled,
  secondaryButton,
  secondSecondaryLabel,
  onSecondSecondaryClick,
  secondSecondaryDisabled,
  primaryLabel,
  onPrimaryClick,
  onPrimaryBlocked,
  primaryDisabled,
  primaryLoading,
  primaryLoadingLabel,
  primaryButton,
}: {
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
  /** Full replacement for first secondary slot (e.g. submit button with form attribute) */
  secondaryButton?: ReactNode;
  /** Optional second ghost row above primary (e.g. bulk review: Save draft after Back) */
  secondSecondaryLabel?: string;
  onSecondSecondaryClick?: () => void;
  secondSecondaryDisabled?: boolean;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
  onPrimaryBlocked?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLoadingLabel?: string;
  /** Full replacement for primary slot (e.g. submit button) */
  primaryButton?: ReactNode;
}) {
  const showLoading = Boolean(primaryLoading && primaryLoadingLabel);
  const label = showLoading ? primaryLoadingLabel! : (primaryLabel ?? "");
  const primaryInert = showLoading;
  const blocked = primaryInert || Boolean(primaryDisabled);

  const firstSecondary =
    secondaryButton ??
    (secondaryLabel && onSecondaryClick ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={RAIL_SECONDARY_ACTION}
        onClick={onSecondaryClick}
        disabled={secondaryDisabled}
      >
        {secondaryLabel}
      </Button>
    ) : null);

  return (
    <div className="border-border-subtle/45 from-surface to-surface-hover/15 bg-surface dark:from-surface dark:to-surface shrink-0 overflow-hidden border-t bg-gradient-to-b pt-0.5 shadow-[0_-12px_40px_-28px_rgba(15,15,20,0.12)] dark:shadow-[0_-14px_44px_-24px_rgba(0,0,0,0.55)]">
      {firstSecondary}
      {secondSecondaryLabel && onSecondSecondaryClick ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={RAIL_SECONDARY_ACTION}
          onClick={onSecondSecondaryClick}
          disabled={secondSecondaryDisabled}
        >
          {secondSecondaryLabel}
        </Button>
      ) : null}
      <div className="p-0">
        {primaryButton ?? (
          <Button
            type="button"
            size="sm"
            variant="default"
            aria-disabled={blocked}
            className={cn(
              // rounded-b-xl matches parent ActionRail card radius.
              "h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
              blocked
                ? "bg-brand-strong/80 text-brand-on hover:bg-brand-strong/80 pointer-events-auto cursor-not-allowed opacity-95"
                : "bg-brand-strong text-brand-on hover:bg-brand-strong/92"
            )}
            onClick={() => {
              if (primaryInert) return;
              if (primaryDisabled) {
                onPrimaryBlocked?.();
                return;
              }
              onPrimaryClick?.();
            }}
          >
            {label}
          </Button>
        )}
      </div>
    </div>
  );
}
