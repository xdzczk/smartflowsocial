import { cn } from "~/lib/utils";

import { SettingsSectionHeader } from "./SettingsSectionHeader";

export interface ManagementListSectionProps {
  title: string;
  description?: string;
  /** Primary list action (e.g. Add queue type) — outline/secondary, not full-width primary. */
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Pattern B — repeatable lists (queues, relays, blocklists). Row-first; reserve full cards for dense items.
 */
export function ManagementListSection({
  title,
  description,
  primaryAction,
  children,
  footer,
  className,
}: ManagementListSectionProps) {
  return (
    <section
      className={cn(
        "border-border/80 bg-surface-hover/15 rounded-lg border px-4 py-4 sm:px-5 sm:py-5",
        className
      )}
    >
      <SettingsSectionHeader
        title={title}
        description={description}
        actions={primaryAction}
      />
      <div className="border-border/60 mt-4 border-t pt-4">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
