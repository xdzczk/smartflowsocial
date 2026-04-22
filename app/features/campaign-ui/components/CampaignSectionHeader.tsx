import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function CampaignSectionHeader({
  id,
  title,
  description,
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 id={id} className="text-text text-h3">
        {title}
      </h2>
      {description ? (
        <p className="text-text-secondary max-w-prose text-sm leading-snug">
          {description}
        </p>
      ) : null}
    </div>
  );
}
