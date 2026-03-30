import { Link } from "@remix-run/react";

import { cn } from "~/lib/utils";

import { PUBLISHING_SEGMENTED_ROW_H } from "./constants";

const segmentClass = (active: boolean) =>
  cn(
    PUBLISHING_SEGMENTED_ROW_H,
    "flex min-w-0 flex-1 items-center justify-center px-2 text-center text-xs transition-colors sm:min-w-[3.5rem] sm:px-2.5",
    active
      ? "text-foreground bg-muted/40 relative z-[1] font-semibold"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/20 font-medium"
  );

export interface PublishingSegmentLinkItem {
  id: string;
  label: string;
  to: string;
  ariaLabel: string;
}

export function PublishingSegmentedControlLinks({
  items,
  activeId,
  ariaLabel,
  className,
  "data-testid": dataTestId,
}: {
  items: PublishingSegmentLinkItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className={cn(
        "border-border/60 bg-background inline-flex max-w-full min-w-0 overflow-x-auto rounded-lg border",
        className
      )}
    >
      {items.map((item, index) => {
        const active = activeId === item.id;
        return (
          <Link
            key={item.id}
            to={item.to}
            aria-current={active ? "page" : undefined}
            aria-label={item.ariaLabel}
            className={cn(
              segmentClass(active),
              index > 0 && "border-border/60 border-l"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export interface PublishingSegmentButtonItem {
  id: string;
  label: string;
  ariaLabel: string;
}

export function PublishingSegmentedControlButtons({
  items,
  value,
  onValueChange,
  radiogroupAriaLabel,
  className,
  "data-testid": dataTestId,
}: {
  items: PublishingSegmentButtonItem[];
  value: string;
  onValueChange: (next: string) => void;
  radiogroupAriaLabel: string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={radiogroupAriaLabel}
      data-testid={dataTestId}
      className={cn(
        "border-border/60 bg-background inline-flex max-w-full min-w-0 overflow-x-auto rounded-lg border",
        className
      )}
    >
      {items.map((item, index) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={item.ariaLabel}
            className={cn(
              segmentClass(active),
              index > 0 && "border-border/60 border-l"
            )}
            onClick={() => onValueChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
