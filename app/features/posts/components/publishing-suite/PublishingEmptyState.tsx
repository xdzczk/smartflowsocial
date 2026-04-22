import type { ReactNode } from "react";

import { EmptyState } from "~/components/ui/empty-state";

/**
 * Domain wrapper that delegates to the canonical <EmptyState>. The
 * publishing surfaces accept actions via `children` (legacy shape) which
 * are passed straight through to the primitive's action slot.
 *
 * Phase 1i. Previously a standalone implementation; consolidated onto
 * the shared primitive so all empty states across the app render with
 * the same icon / title / body / CTA proportions.
 */
export function PublishingEmptyState({
  icon,
  title,
  description,
  children,
  className,
  "data-testid": dataTestId,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <EmptyState
      data-testid={dataTestId}
      icon={icon}
      title={title}
      description={description}
      action={children}
      className={className}
    />
  );
}
