import { convertToHex } from "~/lib/nostr-conversion";

import type {
  AccountPublishRelaySource,
  ComposerRelayLists,
} from "./composer-relay-lists";
import {
  fetchAuthorNip65Kind10002RelayData,
  fetchAuthorNip65WriteRelays,
} from "./nip65-profile-relays.server";
import type { Nip65ProfileRelayEntry } from "./nip65-relay-entry";
import { blastrRelay, DEFAULT_USER_WRITE_RELAYS } from "./relay-constants";
import {
  getRelayIntentFromDb,
  isBlastrEnabledForUserFromDb,
} from "./repositories/relay-resolution-data.server";

export type ManagedRelayId = "blastr";
export type ManagedRelayRole = "fanout";

export interface ManagedRelay {
  id: ManagedRelayId;
  role: ManagedRelayRole;
  enabled: boolean;
  relayUrl: string;
}

export interface RelayIntent {
  writeRelays: string[];
}

export type PublishRelaySource = AccountPublishRelaySource;

function normalizeRelays(relays: string[]): string[] {
  return Array.from(new Set(relays.map((r) => r.trim()).filter(Boolean)));
}

async function fetchNip65WriteRelaysWithTimeout(
  hex: string,
  timeoutMs: number
): Promise<string[]> {
  try {
    return await Promise.race<string[]>([
      fetchAuthorNip65WriteRelays(hex),
      new Promise<string[]>((resolve) => {
        setTimeout(() => resolve([]), timeoutMs);
      }),
    ]);
  } catch {
    return [];
  }
}

function resolveAppWriteRelays(persistedAppRelays: string[]): string[] {
  return persistedAppRelays.length > 0
    ? normalizeRelays(persistedAppRelays)
    : DEFAULT_USER_WRITE_RELAYS;
}

/**
 * Settings loader: one DB read, one NIP-65 fetch, shared effective intent for ACK URLs + managed relays.
 */
export async function loadRelaySettingsLoaderSlice(userId: string): Promise<{
  appRelays: string[];
  publishRelaySource: PublishRelaySource;
  npub: string;
  relayIntent: RelayIntent;
  profileRelays: string[];
  profileRelayEntries: Nip65ProfileRelayEntry[];
}> {
  const row = await getRelayIntentFromDb(userId);
  const appRelays = resolveAppWriteRelays(row.appRelays);
  const hex = convertToHex(row.npub);
  const nip65 = hex
    ? await fetchAuthorNip65Kind10002RelayData(hex)
    : {
        entries: [] as Nip65ProfileRelayEntry[],
        writeRelayUrls: [] as string[],
      };
  const profileRelays = nip65.writeRelayUrls;
  const profileRelayEntries = nip65.entries;

  const relayIntent: RelayIntent =
    row.publishRelaySource === "nip65_profile"
      ? {
          writeRelays:
            profileRelays.length > 0
              ? profileRelays
              : DEFAULT_USER_WRITE_RELAYS,
        }
      : { writeRelays: appRelays };

  return {
    appRelays,
    publishRelaySource: row.publishRelaySource,
    npub: row.npub,
    relayIntent,
    profileRelays,
    profileRelayEntries,
  };
}

/**
 * Read effective relay intent for publishing (write relays only).
 * - `app`: uses `User.userRelays` with `DEFAULT_USER_WRITE_RELAYS` when empty.
 * - `nip65_profile`: uses kind 10002 write relays for the user's npub; falls back to defaults when none found.
 * - NEVER injects managed relays here.
 */
export async function getRelayIntent(userId: string): Promise<RelayIntent> {
  const { appRelays, publishRelaySource, npub } =
    await getRelayIntentFromDb(userId);

  if (publishRelaySource === "nip65_profile") {
    const hex = convertToHex(npub);
    const fromProfile = hex ? await fetchAuthorNip65WriteRelays(hex) : [];
    const writeRelays =
      fromProfile.length > 0 ? fromProfile : DEFAULT_USER_WRITE_RELAYS;
    return { writeRelays };
  }

  return { writeRelays: resolveAppWriteRelays(appRelays) };
}

/**
 * Compute the effective write relays for publishing (direct intent + managed relays).
 * - direct: user intent (persisted)
 * - managed: computed from feature access (Plan.enableRelayBlast + ACTIVE subscription)
 */
export async function getEffectiveWriteRelays(
  userId: string,
  options?: { intent?: RelayIntent }
): Promise<{
  direct: string[];
  managed: ManagedRelay[];
}> {
  const intent = options?.intent ?? (await getRelayIntent(userId));
  const blastrEnabled = await isBlastrEnabledForUserFromDb(userId);

  const managed: ManagedRelay[] = [
    {
      id: "blastr",
      role: "fanout",
      enabled: blastrEnabled,
      relayUrl: blastrRelay,
    },
  ];

  return {
    direct: intent.writeRelays,
    managed,
  };
}

/**
 * Flatten effective write relays into a single list suitable for execution.
 * The publisher layer may still prioritize/deprioritize based on health.
 */
export async function resolveExecutionRelays(
  userId: string
): Promise<string[]> {
  const { direct, managed } = await getEffectiveWriteRelays(userId);
  const enabledManagedRelays = managed
    .filter((m) => m.enabled)
    .map((m) => m.relayUrl);
  return normalizeRelays([...enabledManagedRelays, ...direct]);
}

/**
 * Relay lists for the composer “Post target” modal: account default, forced app list,
 * and forced NIP-65 profile list (each includes Blastr when enabled).
 */
export async function loadComposerRelayLists(
  userId: string
): Promise<
  { accountPublishRelaySource: AccountPublishRelaySource } & ComposerRelayLists
> {
  const row = await getRelayIntentFromDb(userId);
  const appIntent: RelayIntent = {
    writeRelays: resolveAppWriteRelays(row.appRelays),
  };
  const hex = convertToHex(row.npub);
  const shouldResolveProfileRelays = row.publishRelaySource === "nip65_profile";
  const fromProfile =
    shouldResolveProfileRelays && hex
      ? await fetchNip65WriteRelaysWithTimeout(hex, 800)
      : [];
  const profileIntent: RelayIntent = {
    writeRelays:
      fromProfile.length > 0 ? fromProfile : DEFAULT_USER_WRITE_RELAYS,
  };
  const defaultIntent: RelayIntent =
    row.publishRelaySource === "nip65_profile" ? profileIntent : appIntent;

  const blastrEnabled = await isBlastrEnabledForUserFromDb(userId);
  const managed: ManagedRelay[] = [
    {
      id: "blastr",
      role: "fanout",
      enabled: blastrEnabled,
      relayUrl: blastrRelay,
    },
  ];

  const flatten = (intent: RelayIntent): string[] => {
    const enabledManagedRelays = managed
      .filter((m) => m.enabled)
      .map((m) => m.relayUrl);
    return normalizeRelays([...enabledManagedRelays, ...intent.writeRelays]);
  };

  return {
    accountPublishRelaySource: row.publishRelaySource,
    default: flatten(defaultIntent),
    app: flatten(appIntent),
    nip65Profile: flatten(profileIntent),
  };
}

/**
 * When the client sends `relays` as a JSON string array (composer relay picker),
 * use that list; otherwise {@link resolveExecutionRelays}.
 */
export async function resolveExecutionRelaysFromForm(
  userId: string,
  formData: FormData
): Promise<string[]> {
  const relayOverrideRaw = formData.get("relays");
  if (relayOverrideRaw && typeof relayOverrideRaw === "string") {
    try {
      const parsed = JSON.parse(relayOverrideRaw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const urls = parsed.filter((r): r is string => typeof r === "string");
        if (urls.length > 0) return normalizeRelays(urls);
      }
    } catch {
      // fall through to server defaults
    }
  }
  return resolveExecutionRelays(userId);
}

/**
 * Helper for mapping upstream publisher results into an ACK-like status.
 * (Used by ACK persistence plumbing; kept here so callers share a single mapping.)
 */
export function mapPublisherOkToAckStatus(input: {
  ok: boolean;
  error?: string;
}): "ACCEPTED" | "FAILED" | "TIMEOUT" {
  if (input.ok) return "ACCEPTED";
  const m = input.error?.toLowerCase() ?? "";
  return m.includes("timeout") || m.includes("timed out")
    ? "TIMEOUT"
    : "FAILED";
}
