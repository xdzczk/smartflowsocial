/**
 * User Feature Public API
 *
 * This module exports the public API for user-related operations.
 * Internal implementation details are kept in services/ and queries/ directories.
 */

// Re-export Prisma types for convenience (from feature data layer)
export type {
  User,
  HashTagPreset,
  QueueType,
  ScheduleType,
  UploadProvider,
} from "./data/user-prisma-types.server";

// User Profile
export {
  updateUserProfile,
  getUserById,
  getUserByNpub,
  createUser,
  type UserWithHashTagPresets,
} from "./services/user-profile.server";

// Hashtag Presets
export {
  createHashTagPreset,
  updateHashTagPreset,
  deleteHashTagPreset,
  getUserHashTagPresets,
  getHashTagPresetById,
  hashTagPresetExistsForUser,
  updateUserHashTagsAndSettings,
  getShowHashTagsInPosts,
  updateShowHashTagsInPosts,
} from "./services/hashtag-presets.server";

// User Settings
export {
  updateUserTimezone,
  getUserTimezone,
  updateUserRelays,
  updateUserRelayPublishingPreferences,
  type PublishRelaySource,
  getUserRelays,
  updateGiveawayBlacklist,
  getGiveawayBlacklist,
  updateScheduleInterval,
  getScheduleInterval,
  updateUserUploadProvider,
  getUserUploadProvider,
  getUserCustomBlossomUrl,
  updateUserCustomBlossomUrl,
  updateUserUploadProviderSettings,
  getResolvedUploadProviderSettings,
  resolveUploadProviderWithTierDefaults,
  getUserEnableMirrorBlossom,
  updateUserEnableMirrorBlossom,
  getUserBlastrRelayEnabled,
  updateUserBlastrRelayEnabled,
  getUserMirrorUploadUrls,
  updateUserMirrorUploadUrls,
  updateUserMutedList,
  getUserMutedList,
  updateUserFilterMuted,
  getUserFilterMuted,
  updateUserHidePostsFromLowTrustUsers,
  getUserHidePostsFromLowTrustUsers,
  getUserPushNotificationPreferences,
  updateUserPushNotificationPreferences,
  getUserTimeFormat,
  updateUserTimeFormat,
  DEFAULT_ZAP_AMOUNT_SATS_FALLBACK,
  getUserDefaultZapAmountSats,
  getUserDefaultZapAmountSatsStored,
  updateUserDefaultZapAmountSats,
  getUserDateFormat,
  updateUserDateFormat,
  getUserPreferredNostrClient,
  getUserCustomNostrClientBaseUrl,
  updateUserPreferredNostrClient,
  PREFERRED_NOSTR_CLIENT_PRESETS,
  type PreferredNostrClientPreset,
  getLocaleDefaultsAppliedAt,
  applyLocaleDefaultsOnce,
  getUserPrimarySignerProfile,
  updateUserPrimarySignerProfile,
  clearUserPrimarySignerProfile,
  type DateFormatKey,
  getRunwaySettings,
  getUserIdWithRunwayLowNotificationEnabled,
  updateRunwaySettings,
  updateScheduleOverviewTarget,
  type RunwaySettings,
  type RunwayMode,
} from "./services/user-settings.server";

export { invalidateRelayIntentCache } from "./services/user-cache.server";

// Queue Types
export {
  createDefaultQueueTypes,
  updateQueueType,
  deleteQueueType,
  getQueueTypes,
  getQueueTypeByIdForUser,
  getQueueTypeByNameForUser,
} from "./services/queue-types.server";

// NWC (Nostr Wallet Connect)
export {
  updateUserNWC,
  updateUserNWCEnabled,
  clearUserNWC,
  getUserNWC,
  getDecryptedUserNWC,
} from "./services/nwc.server";

// Parent/Child Accounts
export {
  searchUsersByProfileName,
  requestChildLink,
  cancelChildLinkRequest,
  getConfirmedChildrenForParent,
  getPendingChildrenForParent,
  getPendingParentRequestsForChild,
  respondToChildRequest,
  unlinkParent,
  unlinkChildByParent,
} from "./services/parent-child.server";

// User Queries
export {
  getUserBasicInfo,
  getUsersByNpubs,
  getUserByNpubWithProfile,
  getUserIdByNpub,
  countUsers,
  getEnabledUsersWithSubscriptions,
  disableUserAccount,
} from "./queries/user-queries.server";

// ============================================================================
// API Services
// ============================================================================

export {
  loadChildrenData,
  handleChildrenApiError,
} from "./services/children-api.server";

export {
  loadParentData,
  handleParentApiError,
} from "./services/parent-api.server";

export {
  loadDashboardData,
  handleDashboardAction,
} from "./services/dashboard.server";

export {
  getFeedbackInboxPubkeyHex,
  loadFeedbackInboxKind10050Relays,
  validateUserSignedFeedbackDm,
  validateUserSignedFeedbackGiftWrap,
} from "./services/product-feedback.server";

export { loadUploadProviderSettings } from "./services/upload-provider.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { AccountsSettings } from "./components/AccountsSettings";
export { DashboardLayoutPage } from "./components/DashboardLayoutPage";
