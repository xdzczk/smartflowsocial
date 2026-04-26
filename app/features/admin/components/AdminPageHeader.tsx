import { useRevalidator } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

/**
 * Page title row for admin sub-pages — matches publishing library header
 * hierarchy (`text-h2` + `text-sm` subtitle) with admin-only refresh control.
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
    <header className="border-border flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-text text-h2">{title}</h1>
        {subtitle ? (
          <p className="text-text-secondary max-w-2xl text-sm">{subtitle}</p>
        ) : null}
        {generatedAt ? (
          <p className="text-text-secondary mt-1 text-xs">
            Last updated:{" "}
            {formatDate(generatedAt, {
              dateFormatOptions: {
                dateStyle: "medium",
                timeStyle: "short",
              },
            })}
          </p>
        ) : null}
      </div>
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
    </header>
  );
}
