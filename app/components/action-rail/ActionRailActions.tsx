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
    <div className="border-border/60 bg-card/80 shrink-0 overflow-hidden border-t">
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
              "h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
              blocked
                ? "bg-primary/80 text-primary-foreground hover:bg-primary/80 pointer-events-auto cursor-not-allowed opacity-95"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
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
