export function SettingsPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse overflow-x-hidden p-4 sm:p-6"
      aria-busy="true"
      aria-label="Loading settings"
      data-testid="settings-page-skeleton"
    >
      <div className="mb-6 sm:mb-8">
        <div className="bg-muted h-8 w-40 rounded-md sm:h-9 sm:w-48" />
        <div className="bg-muted mt-3 h-4 w-full max-w-md rounded-md" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="hidden shrink-0 lg:block lg:w-60">
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-muted h-10 rounded-md" />
            ))}
          </div>
        </div>
        <div className="lg:hidden">
          <div className="bg-muted mb-2 h-4 w-20 rounded-md" />
          <div className="bg-muted h-10 w-full rounded-md" />
        </div>

        <div className="max-w-[900px] min-w-0 flex-1 space-y-4">
          <div className="bg-muted h-32 rounded-lg" />
          <div className="bg-muted h-40 rounded-lg" />
          <div className="bg-muted h-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
