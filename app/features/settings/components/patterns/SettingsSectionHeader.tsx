import { cn } from "~/lib/utils";

export interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
  /** Secondary actions (e.g. Add, Manage) — keep lightweight; primary commits belong in section body. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent section title row for all settings patterns.
 */
export function SettingsSectionHeader({
  title,
  description,
  actions,
  className,
}: SettingsSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-text text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-text-secondary mt-1 text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
