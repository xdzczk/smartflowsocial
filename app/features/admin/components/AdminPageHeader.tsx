import { useRevalidator } from "@remix-run/react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

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
    <div className="border-border stack-tight border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-h1">{title}</h1>
        {subtitle ? (
          <p className="text-text-secondary text-body-sm mt-1 max-w-3xl">
            {subtitle}
          </p>
        ) : null}
        {generatedAt ? (
          <p className="text-text-secondary mt-2 text-xs">
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
      <button
        type="button"
        onClick={() => revalidator.revalidate()}
        className="border-border text-text hover:bg-surface-hover shrink-0 rounded-md border px-3 py-1.5 text-sm"
        disabled={revalidator.state === "loading"}
      >
        {revalidator.state === "loading" ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
