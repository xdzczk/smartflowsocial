import { useRevalidator } from "@remix-run/react";

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

  return (
    <div className="border-border flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            {subtitle}
          </p>
        ) : null}
        {generatedAt ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Last updated: {new Date(generatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => revalidator.revalidate()}
        className="border-border text-foreground hover:bg-muted shrink-0 rounded-md border px-3 py-1.5 text-sm"
        disabled={revalidator.state === "loading"}
      >
        {revalidator.state === "loading" ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
