import { CampaignActivityLogShell } from "~/features/campaign-ui";

import { contestCopy } from "../contest-copy";

export function ContestActivityLog({
  events,
}: {
  events: Array<{
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
  }>;
}) {
  return (
    <CampaignActivityLogShell
      title={contestCopy.activityLog}
      items={events.map((event) => ({
        id: event.id,
        at: event.createdAt,
        type: event.eventType,
        message: event.message,
      }))}
    />
  );
}
