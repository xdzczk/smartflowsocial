export function SettingsActivePanelSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Loading settings section"
      data-testid="settings-active-panel-skeleton"
    >
      <div className="bg-surface-hover h-36 rounded-lg" />
      <div className="bg-surface-hover h-44 rounded-lg" />
      <div className="bg-surface-hover h-40 rounded-lg" />
    </div>
  );
}
