import { Link } from "@remix-run/react";

import { cn } from "~/lib/utils";

import {
  PUBLISHING_FILTER_CONTROL_BASE_CLASS,
  PUBLISHING_FILTER_CONTROL_RADIUS,
  PUBLISHING_SEGMENTED_ROW_H,
} from "./constants";

const segmentClass = (active: boolean, rowHeightClassName?: string) =>
  cn(
    rowHeightClassName ?? PUBLISHING_SEGMENTED_ROW_H,
    "focus-ring flex min-w-0 flex-1 items-center justify-center px-2 text-center text-xs font-medium motion-fast sm:min-w-[3.5rem] sm:px-2.5",
    active
      ? "bg-surface-selected text-text relative z-[1] font-semibold"
      : "text-text-secondary hover:bg-surface-hover/20 hover:text-text"
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
  rowHeightClassName,
  "data-testid": dataTestId,
}: {
  items: PublishingSegmentLinkItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
  rowHeightClassName?: string;
  "data-testid"?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className={cn(
        PUBLISHING_FILTER_CONTROL_BASE_CLASS,
        PUBLISHING_FILTER_CONTROL_RADIUS,
        "inline-flex max-w-full min-w-0 overflow-x-auto border",
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
              segmentClass(active, rowHeightClassName),
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
  rowHeightClassName,
  "data-testid": dataTestId,
}: {
  items: PublishingSegmentButtonItem[];
  value: string;
  onValueChange: (next: string) => void;
  radiogroupAriaLabel: string;
  className?: string;
  rowHeightClassName?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={radiogroupAriaLabel}
      data-testid={dataTestId}
      className={cn(
        PUBLISHING_FILTER_CONTROL_BASE_CLASS,
        PUBLISHING_FILTER_CONTROL_RADIUS,
        "inline-flex max-w-full min-w-0 overflow-x-auto border",
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
              segmentClass(active, rowHeightClassName),
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
