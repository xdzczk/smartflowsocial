export function BillingSegmentSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Loading billing section"
      data-testid="billing-segment-skeleton"
    >
      <div className="bg-surface-hover h-24 rounded-lg" />
      <div className="bg-surface-hover h-40 rounded-lg" />
      <div className="bg-surface-hover h-32 rounded-lg" />
    </div>
  );
}
