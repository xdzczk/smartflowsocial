import { useRevalidator } from "@remix-run/react";

import { PageHeader } from "~/components/layout/PageHeader";
import { Button } from "~/components/ui/button";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

/**
 * Admin sub-page title row — `PageHeader` `admin` variant + refresh.
 * Horizontal padding comes from `DashboardLayoutPage`’s main band; border spans
 * the band width.
 */
export function AdminPageHeader({
  title,
  subtitle,
  generatedAt,
}: {
  title: string;
  subtitle?: string;
  generatedAt?: string;
}) {
  const revalidator = useRevalidator();
  const { formatDate } = useFormattedDate();

  return (
    <PageHeader
      variant="admin"
      title={title}
      subtitle={subtitle}
      meta={
        generatedAt ? (
          <p className="text-text-secondary mt-1 text-xs">
            Last updated:{" "}
            {formatDate(generatedAt, {
              dateFormatOptions: {
                dateStyle: "medium",
                timeStyle: "short",
              },
            })}
          </p>
        ) : undefined
      }
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state === "loading"}
        >
          {revalidator.state === "loading" ? "Refreshing…" : "Refresh"}
        </Button>
      }
    />
  );
}
