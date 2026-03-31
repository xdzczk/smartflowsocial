import { isSubscriptionActiveForGating } from "~/features/payments/subscriptions.server";
import type {
  User,
  UploadProvider,
} from "~/features/user/data/user-prisma-types.server";
import {
  updateUserUploadProviderRow,
  findUserCustomBlossomUrlRow,
  updateUserCustomBlossomUrlRow,
  updateUserUploadProviderSettingsRow,
  findUserUploadProviderSettingsRow,
  findUserEnableMirrorBlossomRow,
  updateUserEnableMirrorBlossomRow,
  findUserBlastrRelayEnabledRow,
  updateUserBlastrRelayEnabledRow,
  findUserMirrorUploadUrlsRow,
  updateUserMirrorUploadUrlsRow,
} from "~/features/user/repositories/user-settings-data.server";

/**
 * Updates user's upload provider
 */
export function updateUserUploadProvider(
  userId: string,
  uploadProvider: UploadProvider
): Promise<User> {
  return updateUserUploadProviderRow(userId, uploadProvider);
}

function resolveFallbackBlossomProvider(isPaidActive: boolean): UploadProvider {
  return isPaidActive ? "BLOSSOM_SFS" : "BLOSSOM_PRIMAL";
}

function normalizeUploadProvider(
  provider: string | null | undefined
): UploadProvider | null {
  if (!provider) {
    return null;
  }

  const providerStr = String(provider);
  if (providerStr === "BLOSSOM") {
    return "BLOSSOM_PRIMAL";
  }
  if (
    providerStr === "S3" ||
    providerStr === "BLOSSOM_PRIMAL" ||
    providerStr === "BLOSSOM_BLOSSTR" ||
    providerStr === "BLOSSOM_SFS" ||
    providerStr === "BLOSSOM_CUSTOM"
  ) {
    return providerStr;
  }
  return null;
}

export function resolveUploadProviderWithTierDefaults(params: {
  persistedProvider: string | null | undefined;
  isPaidActive: boolean;
}): UploadProvider {
  const normalized = normalizeUploadProvider(params.persistedProvider);

  if (
    normalized === "BLOSSOM_PRIMAL" ||
    normalized === "BLOSSOM_BLOSSTR" ||
    normalized === "BLOSSOM_SFS" ||
    normalized === "BLOSSOM_CUSTOM"
  ) {
    return normalized;
  }

  return resolveFallbackBlossomProvider(params.isPaidActive);
}

/**
 * Gets user's upload provider.
 * Explicit Blossom choice wins; S3/missing resolves by tier default (free => BLOSSOM_PRIMAL, paid => BLOSSOM_SFS).
 */
export async function getUserUploadProvider(
  userId: string
): Promise<UploadProvider> {
  const settings = await getResolvedUploadProviderSettings(userId);
  return settings.provider;
}

export async function getUserCustomBlossomUrl(
  userId: string
): Promise<string | null> {
  const user = await findUserCustomBlossomUrlRow(userId);
  return user?.customBlossomUrl ?? null;
}

export function updateUserCustomBlossomUrl(
  userId: string,
  customBlossomUrl: string | null
): Promise<User> {
  return updateUserCustomBlossomUrlRow(userId, customBlossomUrl);
}

export async function updateUserUploadProviderSettings(
  userId: string,
  uploadProvider: UploadProvider,
  customBlossomUrl: string | null
): Promise<User> {
  return updateUserUploadProviderSettingsRow(
    userId,
    uploadProvider,
    uploadProvider === "BLOSSOM_CUSTOM" ? customBlossomUrl : null
  );
}

export async function getResolvedUploadProviderSettings(
  userId: string
): Promise<{
  /** Effective provider for uploads and `/api/user-upload-provider`. */
  provider: UploadProvider;
  customBlossomUrl: string | null;
  /**
   * Persisted preference from DB after tier defaults (S3 → plan default).
   * May be `BLOSSOM_SFS` while `provider` is `BLOSSOM_PRIMAL` when subscription is inactive.
   */
  storedUploadProvider: UploadProvider;
}> {
  const user = await findUserUploadProviderSettingsRow(userId);
  const isPaidActive = await isSubscriptionActiveForGating(userId);
  const storedUploadProvider = resolveUploadProviderWithTierDefaults({
    persistedProvider: user?.uploadProvider ?? null,
    isPaidActive,
  });
  const customBlossomUrl = user?.customBlossomUrl ?? null;
  let provider =
    storedUploadProvider === "BLOSSOM_CUSTOM" && !customBlossomUrl
      ? resolveFallbackBlossomProvider(isPaidActive)
      : storedUploadProvider;

  if (provider === "BLOSSOM_SFS" && !isPaidActive) {
    provider = "BLOSSOM_PRIMAL";
  }

  return {
    provider,
    customBlossomUrl,
    storedUploadProvider,
  };
}

/**
 * Gets whether user has mirror Blossom enabled
 */
export async function getUserEnableMirrorBlossom(
  userId: string
): Promise<boolean> {
  const user = await findUserEnableMirrorBlossomRow(userId);
  return user?.enableMirrorBlossom ?? false;
}

/**
 * Updates whether user has mirror Blossom enabled
 */
export function updateUserEnableMirrorBlossom(
  userId: string,
  enableMirrorBlossom: boolean
): Promise<User> {
  return updateUserEnableMirrorBlossomRow(userId, enableMirrorBlossom);
}

/**
 * Gets whether user has SFS Blastr relay enabled (when eligible)
 */
export async function getUserBlastrRelayEnabled(
  userId: string
): Promise<boolean> {
  const user = await findUserBlastrRelayEnabledRow(userId);
  return user?.blastrRelayEnabled ?? true;
}

/**
 * Updates whether user has SFS Blastr relay enabled (when eligible)
 */
export function updateUserBlastrRelayEnabled(
  userId: string,
  blastrRelayEnabled: boolean
): Promise<User> {
  return updateUserBlastrRelayEnabledRow(userId, blastrRelayEnabled);
}

/**
 * Gets user's mirror upload URLs
 */
export async function getUserMirrorUploadUrls(
  userId: string
): Promise<string[]> {
  const user = await findUserMirrorUploadUrlsRow(userId);
  return user?.mirrorUploadUrls ?? [];
}

/**
 * Updates user's mirror upload URLs
 */
export function updateUserMirrorUploadUrls(
  userId: string,
  mirrorUrls: string[]
): Promise<User> {
  return updateUserMirrorUploadUrlsRow(userId, mirrorUrls);
}
