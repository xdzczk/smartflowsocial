import { cn } from "~/lib/utils";

import { SettingsSectionHeader } from "./SettingsSectionHeader";

export interface ProviderSelectionSectionProps {
  title: string;
  description?: string;
  /** Selectable option tiles / rich radios */
  children: React.ReactNode;
  /** Shown when an option is chosen (e.g. provider-specific fields). */
  conditionalPanel?: React.ReactNode;
  className?: string;
}

/**
 * Pattern C — mutually exclusive infrastructure choices (storage provider, relay source).
 */
export function ProviderSelectionSection({
  title,
  description,
  children,
  conditionalPanel,
  className,
}: ProviderSelectionSectionProps) {
  return (
    <section
      className={cn(
        "border-border/80 bg-surface-hover/15 rounded-lg border px-4 py-4 sm:px-5 sm:py-5",
        className
      )}
    >
      <SettingsSectionHeader title={title} description={description} />
      <div className="mt-4 space-y-4">{children}</div>
      {conditionalPanel ? (
        <div className="border-border/60 mt-4 border-t pt-4">
          {conditionalPanel}
        </div>
      ) : null}
    </section>
  );
}
