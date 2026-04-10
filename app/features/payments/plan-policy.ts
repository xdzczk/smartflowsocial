import type { PlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import type { BroadcastAudienceGate } from "~/features/payments/types";

import type {
  CommercialPlanType,
  CommercialPublicPlanName,
} from "./plan-mapping";

export interface CanonicalPlanPolicy {
  publicPlanName: CommercialPublicPlanName;
  planType: CommercialPlanType;
  /** Connected identities included on one subscription (pricing / marketing source of truth). */
  accountsIncluded: number;

  execution: {
    maxFutureScheduledItems: number | null;
    maxQueues: number | null;
    maxDrafts: number | null;
    maxTemplates: number | null;
    canSendBroadcast: boolean;
    canExecuteBulkActions: boolean;
  };

  campaigns: {
    maxGiveawayWinnerCount: number;
    canUseGiveawayQueueScope: boolean;
    canUseGiveawayPresets: boolean;
    /** Null means “not modeled as a percent right now.” */
    campaignCommissionPercent: number | null;
  };

  broadcasts: {
    maxRecipientsPerCampaign: number;
    maxConcurrentActiveCampaigns: number;
    maxDailyBroadcastRecipients: number;
    allowAdvancedDelivery: boolean;
    allowSchedule: boolean;
    allowStaggered: boolean;
    allowedAudienceTypes: BroadcastAudienceGate[];
  };

  media: {
    canUseSfsBlossomStorage: boolean;
    monthlyStorageBytes: bigint | null;
    monthlyUploadBytes: bigint | null;
    maxFileBytes: number | null;
    maxParallelUploadsHint: number | null;
  };

  powerFeatures: {
    relayBlastAndDistribution: boolean;
  };
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

// This is the primary source of truth for public plan limits and execution entitlements.
const POLICIES: Record<CommercialPlanType, CanonicalPlanPolicy> = {
  free: {
    publicPlanName: "Free",
    planType: "free",
    accountsIncluded: 1,
    execution: {
      maxFutureScheduledItems: 10,
      maxQueues: 1,
      maxDrafts: 5,
      maxTemplates: 5,
      canSendBroadcast: false,
      canExecuteBulkActions: false,
    },
    campaigns: {
      maxGiveawayWinnerCount: 10,
      canUseGiveawayQueueScope: false,
      canUseGiveawayPresets: false,
      campaignCommissionPercent: 10,
    },
    broadcasts: {
      maxRecipientsPerCampaign: 0,
      maxConcurrentActiveCampaigns: 0,
      maxDailyBroadcastRecipients: 0,
      allowAdvancedDelivery: false,
      allowSchedule: false,
      allowStaggered: false,
      allowedAudienceTypes: ["CUSTOM"],
    },
    media: {
      canUseSfsBlossomStorage: false,
      monthlyStorageBytes: null,
      monthlyUploadBytes: null,
      maxFileBytes: null,
      maxParallelUploadsHint: null,
    },
    powerFeatures: {
      relayBlastAndDistribution: false,
    },
  },

  starter: {
    publicPlanName: "Starter",
    planType: "starter",
    accountsIncluded: 1,
    execution: {
      maxFutureScheduledItems: 50,
      maxQueues: 2,
      maxDrafts: 25,
      maxTemplates: 25,
      canSendBroadcast: true,
      canExecuteBulkActions: true,
    },
    campaigns: {
      maxGiveawayWinnerCount: 50,
      canUseGiveawayQueueScope: true,
      canUseGiveawayPresets: true,
      campaignCommissionPercent: 7.5,
    },
    broadcasts: {
      maxRecipientsPerCampaign: 75,
      maxConcurrentActiveCampaigns: 2,
      maxDailyBroadcastRecipients: 150,
      allowAdvancedDelivery: false,
      allowSchedule: true,
      allowStaggered: false,
      allowedAudienceTypes: ["CUSTOM"],
    },
    media: {
      canUseSfsBlossomStorage: true,
      monthlyStorageBytes: BigInt(5 * GB),
      monthlyUploadBytes: BigInt(20 * GB),
      maxFileBytes: 50 * MB,
      maxParallelUploadsHint: 4,
    },
    powerFeatures: {
      relayBlastAndDistribution: false,
    },
  },

  creator: {
    publicPlanName: "Creator",
    planType: "creator",
    accountsIncluded: 2,
    execution: {
      maxFutureScheduledItems: 200,
      maxQueues: 5,
      maxDrafts: 100,
      maxTemplates: 100,
      canSendBroadcast: true,
      canExecuteBulkActions: true,
    },
    campaigns: {
      maxGiveawayWinnerCount: 50,
      canUseGiveawayQueueScope: true,
      canUseGiveawayPresets: true,
      campaignCommissionPercent: 5,
    },
    broadcasts: {
      maxRecipientsPerCampaign: 75,
      maxConcurrentActiveCampaigns: 2,
      maxDailyBroadcastRecipients: 150,
      allowAdvancedDelivery: false,
      allowSchedule: true,
      allowStaggered: false,
      allowedAudienceTypes: ["CUSTOM"],
    },
    media: {
      canUseSfsBlossomStorage: true,
      monthlyStorageBytes: BigInt(10 * GB),
      monthlyUploadBytes: BigInt(40 * GB),
      maxFileBytes: 100 * MB,
      maxParallelUploadsHint: 6,
    },
    powerFeatures: {
      relayBlastAndDistribution: false,
    },
  },

  pro: {
    publicPlanName: "Pro",
    planType: "pro",
    accountsIncluded: 5,
    execution: {
      maxFutureScheduledItems: 1000,
      maxQueues: 15,
      maxDrafts: 500,
      maxTemplates: 500,
      canSendBroadcast: true,
      canExecuteBulkActions: true,
    },
    campaigns: {
      maxGiveawayWinnerCount: 50,
      canUseGiveawayQueueScope: true,
      canUseGiveawayPresets: true,
      campaignCommissionPercent: 0,
    },
    broadcasts: {
      maxRecipientsPerCampaign: 500,
      maxConcurrentActiveCampaigns: 5,
      maxDailyBroadcastRecipients: 2000,
      allowAdvancedDelivery: true,
      allowSchedule: true,
      allowStaggered: true,
      allowedAudienceTypes: ["CUSTOM", "MUTUALS"],
    },
    media: {
      canUseSfsBlossomStorage: true,
      monthlyStorageBytes: BigInt(50 * GB),
      monthlyUploadBytes: BigInt(250 * GB),
      maxFileBytes: 250 * MB,
      maxParallelUploadsHint: 8,
    },
    powerFeatures: {
      relayBlastAndDistribution: true,
    },
  },

  teams: {
    publicPlanName: "Teams",
    planType: "teams",
    accountsIncluded: 1,
    // Temporary: per user decision, treat Teams as paid for now.
    // We use Creator-like limits so we don’t silently grant Pro-only assumptions.
    execution: {
      maxFutureScheduledItems: null,
      maxQueues: null,
      maxDrafts: null,
      maxTemplates: null,
      canSendBroadcast: true,
      canExecuteBulkActions: true,
    },
    campaigns: {
      maxGiveawayWinnerCount: 50,
      canUseGiveawayQueueScope: true,
      canUseGiveawayPresets: true,
      campaignCommissionPercent: 5,
    },
    broadcasts: {
      maxRecipientsPerCampaign: 75,
      maxConcurrentActiveCampaigns: 2,
      maxDailyBroadcastRecipients: 150,
      allowAdvancedDelivery: false,
      allowSchedule: true,
      allowStaggered: false,
      allowedAudienceTypes: ["CUSTOM"],
    },
    media: {
      canUseSfsBlossomStorage: true,
      // Internal-only for now: treat Teams as Pro-equivalent hosted media.
      // IMPORTANT: Do not advertise Teams hosted-media limits on public pricing UI.
      monthlyStorageBytes: BigInt(50 * GB),
      monthlyUploadBytes: BigInt(250 * GB),
      maxFileBytes: 250 * MB,
      maxParallelUploadsHint: 8,
    },
    powerFeatures: {
      relayBlastAndDistribution: false,
    },
  },

  founder: {
    publicPlanName: "Founder",
    planType: "founder",
    accountsIncluded: 5,
    // Founder should behave as paid; spec recommends Pro-like.
    execution: {
      maxFutureScheduledItems: 1000,
      maxQueues: 15,
      maxDrafts: 500,
      maxTemplates: 500,
      canSendBroadcast: true,
      canExecuteBulkActions: true,
    },
    campaigns: {
      maxGiveawayWinnerCount: 50,
      canUseGiveawayQueueScope: true,
      canUseGiveawayPresets: true,
      campaignCommissionPercent: 0,
    },
    broadcasts: {
      maxRecipientsPerCampaign: 500,
      maxConcurrentActiveCampaigns: 5,
      maxDailyBroadcastRecipients: 2000,
      allowAdvancedDelivery: true,
      allowSchedule: true,
      allowStaggered: true,
      allowedAudienceTypes: ["CUSTOM", "MUTUALS"],
    },
    media: {
      canUseSfsBlossomStorage: true,
      // Founder inherits Pro hosted media limits exactly (commercial policy).
      monthlyStorageBytes: BigInt(50 * GB),
      monthlyUploadBytes: BigInt(250 * GB),
      maxFileBytes: 250 * MB,
      maxParallelUploadsHint: 8,
    },
    powerFeatures: {
      relayBlastAndDistribution: true,
    },
  },
};

export function getCanonicalPlanPolicy(
  planType: CommercialPlanType
): CanonicalPlanPolicy {
  return POLICIES[planType];
}

export function toExecutionEntitlements(
  policy: CanonicalPlanPolicy
): PlanEntitlements {
  return {
    maxFutureScheduledItems: policy.execution.maxFutureScheduledItems,
    maxQueues: policy.execution.maxQueues,
    maxDrafts: policy.execution.maxDrafts,
    maxTemplates: policy.execution.maxTemplates,
    canSendBroadcast: policy.execution.canSendBroadcast,
    canExecuteBulkActions: policy.execution.canExecuteBulkActions,
  };
}

export function toGiveawayLimits(policy: CanonicalPlanPolicy): {
  maxWinnerCount: number;
  canUseQueueScope: boolean;
  canUsePresets: boolean;
} {
  return {
    maxWinnerCount: policy.campaigns.maxGiveawayWinnerCount,
    canUseQueueScope: policy.campaigns.canUseGiveawayQueueScope,
    canUsePresets: policy.campaigns.canUseGiveawayPresets,
  };
}

export function toBroadcastLimits(policy: CanonicalPlanPolicy): {
  maxRecipientsPerCampaign: number;
  maxConcurrentActiveCampaigns: number;
  maxDailyBroadcastRecipients: number;
  allowedAudienceTypes: BroadcastAudienceGate[];
  allowAdvancedDelivery: boolean;
  allowSchedule: boolean;
  allowStaggered: boolean;
} {
  return policy.broadcasts;
}
