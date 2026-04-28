/**
 * Engagement feed page title — matches publishing library header hierarchy.
 */

import { PublishingPageHeader } from "~/features/posts/components/publishing-suite/PublishingPageHeader";

export function EngagementHeader() {
  return (
    <div className="pt-2 pb-4">
      <PublishingPageHeader
        title="Engagement"
        subtitle="See who's engaging with your posts."
      />
    </div>
  );
}
