export function SettingsPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl animate-pulse overflow-x-hidden p-4 sm:p-6"
      aria-busy="true"
      aria-label="Loading settings"
    >
      <div className="mb-6 sm:mb-8">
        <div className="bg-muted h-8 w-40 rounded-md sm:h-9 sm:w-48" />
        <div className="bg-muted mt-3 h-4 w-full max-w-md rounded-md" />
      </div>

      <div className="bg-muted mb-6 grid h-auto w-full max-w-full grid-cols-2 gap-1 rounded-lg p-1 sm:grid-cols-3 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="bg-background/60 h-9 rounded-sm" />
        ))}
      </div>

      <div className="space-y-4">
        <div className="bg-muted h-32 rounded-lg" />
        <div className="bg-muted h-40 rounded-lg" />
        <div className="bg-muted h-36 rounded-lg" />
      </div>
    </div>
  );
}
