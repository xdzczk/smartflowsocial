import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { RAIL_STACK_TIGHT } from "./tokens";

/** Primary / secondary summary label+value (calmer than settings rows) */
export function RailSummaryMetadataRow({
  label,
  children,
  secondary,
  className,
}: {
  label: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[11px] leading-snug",
        secondary ? "text-text-secondary" : undefined,
        className
      )}
    >
      <span className="text-text-secondary font-medium">{label}</span>{" "}
      <span className={cn(!secondary && "text-text")}>{children}</span>
    </div>
  );
}

/** Compact metadata token (relays, etc.)  -  not a chip, not a field */
export function RailSummaryToken({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const cls = cn(
    "border-border-subtle/55 bg-surface-hover/35 text-text inline-flex h-5 max-w-full items-center truncate rounded-sm px-1.5 text-[10px] font-medium",
    onClick && "hover:bg-surface-hover/70 cursor-pointer",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }

  return <span className={cls}>{children}</span>;
}

export function RailSummaryDeliveryRow({
  label = "Delivery",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1")}>
      <span className="text-text-secondary text-[11px] font-medium">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

export function RailSummaryOutcomeBlock({
  headline,
  outcomeLine,
  pristineHint,
  className,
}: {
  headline: string;
  outcomeLine: string | null;
  pristineHint?: string | null;
  className?: string;
}) {
  return (
    <div className={cn(RAIL_STACK_TIGHT, className)}>
      {pristineHint ? (
        <p className="text-text-secondary text-[11px] leading-snug">
          {pristineHint}
        </p>
      ) : null}
      <p className="text-text text-[11px] leading-snug">
        <span className="font-medium">{headline}</span>
        {outcomeLine ? (
          <span className="text-text-secondary"> · {outcomeLine}</span>
        ) : null}
      </p>
    </div>
  );
}
