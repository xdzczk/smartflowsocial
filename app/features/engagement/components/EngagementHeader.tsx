/**
 * Engagement feed header component
 */

export function EngagementHeader() {
  return (
    <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <h3 className="mb-1 font-semibold">Engagement Feed</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          See who&apos;s engaging with your posts
        </p>
      </div>
    </div>
  );
}
