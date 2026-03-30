import {
  isPrimarySignerProfile,
  type PrimarySignerProfile,
} from "~/features/auth/signer";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import {
  type HashTagPreset,
  type QueueType,
  convertJsonValueToScheduleConfig,
} from "~/features/posts/server";
import type {
  Nip65ProfileRelayEntry,
  Nip65RelayScope,
} from "~/features/relays/nip65-relay-entry";

export type QueueTypeSettings = QueueType & {
  isDefault: boolean;
  hashTagPreset?: {
    id: string;
    name: string;
    tags: string;
    description?: string;
  } | null;
  hashTagPresetId?: string;
};

export function parseQueueType(qt: unknown): QueueTypeSettings | null {
  if (!qt || typeof qt !== "object" || !("id" in qt) || !("name" in qt)) {
    return null;
  }
  const q = qt as {
    id: string;
    name: string;
    color?: string | null;
    scheduleType?: string;
    scheduleConfig?: unknown;
    isEnabled?: boolean;
    hashTagPresetId?: string;
    isDefault?: boolean;
    colorToken?: string | null;
    hashTagPreset?: {
      id: string;
      name: string;
      tags: string;
      description?: string;
    } | null;
  };
  return {
    id: q.id,
    name: q.name,
    color: getQueueAccentHex(
      (q as { colorToken?: string | null }).colorToken ?? null
    ),
    colorToken: (q as { colorToken?: string | null }).colorToken ?? undefined,
    description: undefined,
    scheduleType: q.scheduleType as
      | "INTERVAL"
      | "FIXED_SLOTS"
      | "WEEKLY_SLOTS"
      | undefined,
    scheduleConfig: convertJsonValueToScheduleConfig(q.scheduleConfig),
    isEnabled: q.isEnabled,
    isDefault: q.isDefault ?? false,
    hashTagPresetId: q.hashTagPresetId,
    hashTagPreset: q.hashTagPreset,
  };
}

export function parseQueueTypes(queueTypesRaw: unknown): QueueTypeSettings[] {
  if (!Array.isArray(queueTypesRaw)) {
    return [];
  }
  return queueTypesRaw
    .map((qt) => parseQueueType(qt))
    .filter((qt): qt is QueueTypeSettings => qt !== null);
}

function isValidHashTagPreset(preset: unknown): preset is {
  id: string;
  name: string;
  tags: string;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId?: unknown;
} {
  return (
    typeof preset === "object" &&
    preset !== null &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).id ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).name ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).tags ===
      "string"
  );
}

function parseDateValue(dateValue: unknown): Date | undefined {
  if (dateValue === null || dateValue === undefined) {
    return undefined;
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === "string") {
    return new Date(dateValue);
  }
  return undefined;
}

function parseHashTagPreset(preset: {
  id: string;
  name: string;
  tags: string;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  userId?: unknown;
}): HashTagPreset {
  return {
    id: preset.id,
    name: preset.name,
    tags: preset.tags,
    description:
      preset.description === null
        ? null
        : typeof preset.description === "string"
          ? preset.description
          : undefined,
    userId: typeof preset.userId === "string" ? preset.userId : undefined,
    createdAt: parseDateValue(preset.createdAt),
    updatedAt: parseDateValue(preset.updatedAt),
  };
}

export function parseHashTagPresets(
  hashTagPresetsRaw: unknown
): HashTagPreset[] {
  if (!Array.isArray(hashTagPresetsRaw)) {
    return [];
  }
  return hashTagPresetsRaw
    .filter((p) => isValidHashTagPreset(p))
    .map((p) => parseHashTagPreset(p));
}

export function parseMutedList(mutedListRaw: unknown): {
  npubs: string[];
  lastSynced: string;
} {
  const mutedListRawTyped = mutedListRaw as
    | { npubs?: unknown; lastSynced?: unknown }
    | null
    | undefined;
  if (
    mutedListRawTyped &&
    typeof mutedListRawTyped === "object" &&
    !Array.isArray(mutedListRawTyped)
  ) {
    return {
      npubs: Array.isArray(mutedListRawTyped.npubs)
        ? (mutedListRawTyped.npubs as string[])
        : [],
      lastSynced:
        typeof mutedListRawTyped.lastSynced === "string"
          ? mutedListRawTyped.lastSynced
          : new Date().toISOString(),
    };
  }
  return { npubs: [], lastSynced: new Date().toISOString() };
}

export interface ManagedRelay {
  id: string;
  role: string;
  enabled: boolean;
  relayUrl: string;
}

export interface RelayAck {
  status: string;
  createdAt: string;
  receivedAt: string | null;
}

export function parsePrimarySignerProfile(
  value: unknown
): PrimarySignerProfile | null {
  return isPrimarySignerProfile(value) ? value : null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function asPublishRelaySource(value: unknown): "app" | "nip65_profile" {
  return value === "nip65_profile" ? "nip65_profile" : "app";
}

export function toIsoStringOrNow(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function toIsoStringOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export function parseProfileRelayEntries(
  value: unknown
): Nip65ProfileRelayEntry[] {
  if (!Array.isArray(value)) return [];
  const scopes = new Set<Nip65RelayScope>(["both", "read", "write"]);
  return value
    .map((e) => {
      if (!e || typeof e !== "object" || Array.isArray(e)) return null;
      const obj = e as Record<string, unknown>;
      const url = typeof obj["url"] === "string" ? obj["url"] : null;
      const scope = typeof obj["scope"] === "string" ? obj["scope"] : null;
      if (!url || !scope || !scopes.has(scope as Nip65RelayScope)) return null;
      return { url, scope: scope as Nip65RelayScope };
    })
    .filter((v): v is Nip65ProfileRelayEntry => v !== null);
}

export function parseManagedRelays(value: unknown): ManagedRelay[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return null;
      const obj = v as Record<string, unknown>;
      const id = typeof obj["id"] === "string" ? obj["id"] : null;
      const role = typeof obj["role"] === "string" ? obj["role"] : null;
      const enabled =
        typeof obj["enabled"] === "boolean" ? obj["enabled"] : null;
      const relayUrl =
        typeof obj["relayUrl"] === "string" ? obj["relayUrl"] : null;
      if (!id || !role || enabled === null || !relayUrl) return null;
      return { id, role, enabled, relayUrl } satisfies ManagedRelay;
    })
    .filter((v): v is ManagedRelay => v !== null);
}

export function parseRelayAcksMap(value: unknown): Record<string, RelayAck> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, RelayAck>;
}
