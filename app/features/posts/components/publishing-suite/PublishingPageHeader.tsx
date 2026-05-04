import type { ReactNode } from "react";

import { PageHeader } from "~/components/layout/PageHeader";

/** Library / queue / settings-style product page title  -  see `PageHeader` variant `library`. */
export function PublishingPageHeader({
  title,
  subtitle,
  actions,
  className,
  titleClassName,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <PageHeader
      variant="library"
      title={title}
      subtitle={subtitle}
      actions={actions}
      className={className}
      titleClassName={titleClassName}
    />
  );
}
