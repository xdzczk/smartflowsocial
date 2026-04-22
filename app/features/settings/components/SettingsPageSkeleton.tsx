export function SettingsPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1400px] animate-pulse overflow-x-hidden px-4 pb-8 sm:px-6"
      aria-busy="true"
      aria-label="Loading settings"
      data-testid="settings-page-skeleton"
    >
      <div className="pt-2 pb-4">
        <div className="bg-surface-hover h-7 w-36 rounded-md" />
        <div className="bg-surface-hover mt-2 h-4 w-full max-w-2xl rounded-md" />
      </div>

      <div className="stack-loose lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:hidden">
          <div className="bg-surface-hover mb-2 h-4 w-32 rounded-md" />
          <div className="bg-surface-hover h-10 w-full rounded-md" />
        </div>

        <div className="w-full max-w-[880px] min-w-0 flex-1 space-y-8">
          <div className="bg-surface-hover h-32 rounded-lg" />
          <div className="bg-surface-hover h-40 rounded-lg" />
          <div className="bg-surface-hover h-36 rounded-lg" />
        </div>

        <div className="border-border bg-surface-raised shadow-2 hidden w-[300px] shrink-0 flex-col rounded-xl border p-2 lg:flex xl:w-[320px]">
          <div className="bg-surface-hover mb-2 h-3 w-16 rounded-md px-2" />
          <div className="space-y-2">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="bg-surface-hover h-10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
