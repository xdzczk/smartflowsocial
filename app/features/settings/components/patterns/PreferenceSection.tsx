import { cn } from "~/lib/utils";

import { SettingsSectionHeader } from "./SettingsSectionHeader";

export interface PreferenceSectionProps {
  title: string;
  description?: string;
  /** Optional header actions (rare for Pattern A — prefer inline field actions). */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  /** Optional footer row (inline save, hints). */
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Pattern A — lightweight app preferences (timezone, formats, toggles).
 * Prefer surfaces + spacing over heavy cards; pair with autosave or inline save, not full-width primary slabs.
 */
export function PreferenceSection({
  title,
  description,
  headerActions,
  children,
  footer,
  className,
  contentClassName,
}: PreferenceSectionProps) {
  return (
    <section
      className={cn(
        "border-border/80 bg-surface-hover/20 rounded-lg border px-4 py-4 sm:px-5 sm:py-5",
        className
      )}
    >
      <SettingsSectionHeader
        title={title}
        description={description}
        actions={headerActions}
      />
      <div className={cn("mt-4 space-y-4", contentClassName)}>{children}</div>
      {footer ? (
        <div className="border-border/60 mt-4 border-t pt-4">{footer}</div>
      ) : null}
    </section>
  );
}
