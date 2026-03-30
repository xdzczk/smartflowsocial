import type { ReactNode } from "react";

import { ActionRailOutcome } from "~/components/action-rail";

export interface CampaignOutcomeSentenceProps {
  headline?: ReactNode;
  outcomeLine?: string | null;
  hint?: string | null;
  className?: string;
}

/** Consistent outcome block for campaign rails (wraps ActionRailOutcome). */
export function CampaignOutcomeSentence(props: CampaignOutcomeSentenceProps) {
  return <ActionRailOutcome {...props} />;
}
