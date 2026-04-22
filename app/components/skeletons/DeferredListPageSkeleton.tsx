export type DeferredListPageSkeletonVariant =
  | "list"
  | "detail"
  | "mediaGallery"
  | "adminDashboard";

export function DeferredListPageSkeleton({
  title,
  subtitle,
  variant = "list",
}: {
  title: string;
  subtitle?: string;
  variant?: DeferredListPageSkeletonVariant;
}) {
  const label = subtitle ? `${title} — ${subtitle}` : title;

  if (variant === "detail") {
    return (
      <div
        className="mx-auto w-full max-w-5xl animate-pulse space-y-6 p-4 sm:p-6"
        aria-busy="true"
        aria-label={label}
      >
        <div className="bg-surface-hover h-4 w-36 rounded-md" />
        <div className="border-border space-y-4 rounded-lg border p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="bg-surface-hover h-8 w-2/3 max-w-md rounded-md sm:h-9" />
              <div className="bg-surface-hover h-4 w-full max-w-xl rounded-md" />
              <div className="bg-surface-hover h-4 w-4/5 max-w-lg rounded-md" />
            </div>
            <div className="bg-surface-hover h-8 w-28 shrink-0 rounded-full" />
          </div>
          <div className="bg-surface-hover mt-2 h-4 w-56 rounded-md" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-surface-hover h-36 rounded-lg" />
          <div className="bg-surface-hover h-36 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="bg-surface-hover h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "mediaGallery") {
    return (
      <div
        className="mx-auto w-full max-w-6xl animate-pulse space-y-6 p-4 sm:p-6"
        aria-busy="true"
        aria-label={label}
      >
        <div className="stack sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="bg-surface-hover h-8 w-40 rounded-md sm:h-9" />
            {subtitle ? (
              <div className="bg-surface-hover h-4 w-full max-w-xl rounded-md" />
            ) : null}
          </div>
          <div className="bg-surface-hover h-9 w-36 shrink-0 rounded-md" />
        </div>
        <div className="border-border rounded-lg border p-6">
          <div className="bg-surface-hover mb-4 h-5 w-24 rounded-md" />
          <div className="flex flex-wrap gap-8">
            <div className="space-y-2">
              <div className="bg-surface-hover h-3 w-16 rounded-md" />
              <div className="bg-surface-hover h-8 w-20 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="bg-surface-hover h-3 w-24 rounded-md" />
              <div className="bg-surface-hover h-8 w-28 rounded-md" />
            </div>
          </div>
          <div className="bg-surface-hover mt-6 h-2 w-full max-w-md rounded-full" />
        </div>
        <div className="border-border rounded-lg border p-6">
          <div className="mb-4 space-y-2">
            <div className="bg-surface-hover h-5 w-40 rounded-md" />
            <div className="bg-surface-hover h-4 w-full max-w-lg rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="space-y-2">
                <div className="bg-surface-hover aspect-square w-full rounded-md" />
                <div className="bg-surface-hover h-3 w-3/4 rounded-md" />
                <div className="bg-surface-hover h-3 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "adminDashboard") {
    return (
      <div
        className="mx-auto w-full max-w-6xl animate-pulse space-y-8 p-4 sm:p-6"
        aria-busy="true"
        aria-label={label}
      >
        <div className="space-y-2">
          <div className="bg-surface-hover h-8 w-52 rounded-md sm:h-9" />
          {subtitle ? (
            <div className="bg-surface-hover h-4 w-full max-w-2xl rounded-md" />
          ) : null}
          <div className="bg-surface-hover h-3 w-40 rounded-md" />
        </div>
        <div className="border-brand/20 bg-surface-hover/30 h-32 rounded-xl border p-4">
          <div className="bg-surface-hover mb-3 h-3 w-48 rounded-md" />
          <div className="bg-surface-hover mb-2 h-4 w-full max-w-3xl rounded-md" />
          <div className="flex flex-wrap gap-3">
            <div className="bg-surface-hover h-3 w-28 rounded-md" />
            <div className="bg-surface-hover h-3 w-32 rounded-md" />
            <div className="bg-surface-hover h-3 w-36 rounded-md" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-surface-hover h-24 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="bg-surface-hover h-5 w-40 rounded-md" />
          <div className="bg-surface-hover h-52 rounded-lg" />
        </div>
        <div className="space-y-3">
          <div className="bg-surface-hover h-5 w-48 rounded-md" />
          <div className="bg-surface-hover h-44 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse space-y-6 p-4 sm:p-6"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="bg-surface-hover h-8 w-48 rounded-md sm:h-9 sm:w-56" />
          {subtitle ? (
            <div className="bg-surface-hover h-4 w-full max-w-xl rounded-md" />
          ) : null}
        </div>
        <div className="bg-surface-hover h-10 w-32 rounded-md" />
      </div>
      <div className="bg-surface-hover h-10 w-full max-w-2xl rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-surface-hover h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
