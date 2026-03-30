import type { GiveawayEngagementType } from "./types";
import { ALL_GIVEAWAY_ENGAGEMENT_TYPES } from "./types";

export const ERROR_GIVEAWAY_NOT_FOUND = "Giveaway not found";

export const DEFAULT_ENGAGEMENT_TYPES: GiveawayEngagementType[] = [
  ...ALL_GIVEAWAY_ENGAGEMENT_TYPES,
];
