import type {
  ComposerContext,
  ComposerEditingMeta,
} from "~/features/posts/composer";
import { parseComposerContextFromLoader } from "~/features/posts/composer";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import type { HashTagPreset, QueueType } from "~/features/posts/types";
import type { AccountPublishRelaySource } from "~/features/relays/composer-relay-lists";

export interface NewLongFormPostLoaderParsed {
  userTags: unknown;
  userTimezone: unknown;
  uploadProvider: unknown;
  defaultRelays: string[];
  relaysApp: string[];
  relaysNip65Profile: string[];
  accountPublishRelaySource: AccountPublishRelaySource;
  initialTemplateData: {
    title?: string;
    summary?: string;
    content?: string;
    image?: string;
    tags?: string[];
    queueType?: { name: string };
  } | null;
  templatesRaw: Array<{ id: string; name: string | null }>;
  scheduleIntervals: number[];
  queueTypes: QueueType[];
  hashTagPresets: HashTagPreset[];
  composerContext: ComposerContext;
  editingMeta: ComposerEditingMeta | null;
  hydrationStatus: "ready" | "error";
  hydrationError: string | null;
}

function parseScheduleIntervals(scheduleIntervalsRaw: unknown): number[] {
  if (!Array.isArray(scheduleIntervalsRaw)) return [];
  return scheduleIntervalsRaw
    .map((s: unknown) => {
      if (typeof s === "string") {
        const parsed = parseFloat(s);
        return Number.isNaN(parsed) ? null : parsed;
      }
      if (typeof s === "number") return s;
      return null;
    })
    .filter((n): n is number => n !== null);
}

function parseQueueHashTagPreset(preset: unknown): QueueType["hashTagPreset"] {
  if (
    preset &&
    typeof preset === "object" &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset
  ) {
    const p = preset as {
      id?: unknown;
      name?: unknown;
      tags?: unknown;
      description?: unknown;
    };
    if (
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.tags === "string"
    ) {
      return {
        id: p.id,
        name: p.name,
        tags: p.tags,
        description: typeof p.description === "string" ? p.description : null,
      };
    }
  }
  return null;
}

function parseQueueTypes(queueTypesRaw: unknown): QueueType[] {
  if (!Array.isArray(queueTypesRaw)) return [];
  return queueTypesRaw
    .map((qt: unknown) => {
      if (
        qt &&
        typeof qt === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data
        qt !== null &&
        "id" in qt &&
        "name" in qt
      ) {
        const q = qt as {
          id?: unknown;
          name?: unknown;
          colorToken?: unknown;
          scheduleType?: unknown;
          scheduleConfig?: unknown;
          isEnabled?: unknown;
          userId?: unknown;
        };
        const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
        const name = typeof q.name === "string" ? q.name : String(q.name ?? "");
        const color = getQueueAccentHex(
          q.colorToken !== null &&
            q.colorToken !== undefined &&
            typeof q.colorToken === "string"
            ? q.colorToken
            : null
        );
        const colorToken =
          q.colorToken !== null &&
          q.colorToken !== undefined &&
          typeof q.colorToken === "string"
            ? q.colorToken
            : null;
        const scheduleType =
          typeof q.scheduleType === "string" &&
          (q.scheduleType === "INTERVAL" ||
            q.scheduleType === "FIXED_SLOTS" ||
            q.scheduleType === "WEEKLY_SLOTS")
            ? q.scheduleType
            : undefined;
        const scheduleConfig = convertJsonValueToScheduleConfig(
          q.scheduleConfig
        );
        const isEnabled =
          typeof q.isEnabled === "boolean"
            ? q.isEnabled
            : q.isEnabled !== false;
        const statusRaw = (q as { status?: unknown }).status;
        const status =
          typeof statusRaw === "string" &&
          (statusRaw === "active" ||
            statusRaw === "paused" ||
            statusRaw === "archived")
            ? statusRaw
            : undefined;
        const userIdVal = typeof q.userId === "string" ? q.userId : "";
        const includeRaw = (q as { includeHashtagsInNoteBody?: unknown })
          .includeHashtagsInNoteBody;
        const presetIdRaw = (q as { hashTagPresetId?: unknown })
          .hashTagPresetId;
        const result: QueueType = {
          id,
          name,
          color,
          colorToken: colorToken ?? undefined,
          description: undefined,
          scheduleType: scheduleType,
          scheduleConfig:
            scheduleConfig as unknown as QueueType["scheduleConfig"],
          status: status,
          isEnabled: isEnabled,
          userId: userIdVal,
          includeHashtagsInNoteBody:
            typeof includeRaw === "boolean" ? includeRaw : undefined,
          hashTagPresetId:
            presetIdRaw === null
              ? null
              : typeof presetIdRaw === "string"
                ? presetIdRaw
                : undefined,
          hashTagPreset: parseQueueHashTagPreset(
            (q as { hashTagPreset?: unknown }).hashTagPreset
          ),
        };
        return result;
      }
      return null;
    })
    .filter((qt): qt is QueueType => qt !== null);
}

function parseHashTagPresets(hashTagPresetsRaw: unknown): HashTagPreset[] {
  if (!Array.isArray(hashTagPresetsRaw)) return [];
  return hashTagPresetsRaw
    .filter(
      (
        preset: unknown
      ): preset is {
        id: string;
        name: string;
        tags: string;
        description?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
        userId?: unknown;
      } =>
        typeof preset === "object" &&
        preset !== null &&
        "id" in preset &&
        "name" in preset &&
        "tags" in preset &&
        typeof (preset as { id: unknown; name: unknown; tags: unknown }).id ===
          "string" &&
        typeof (preset as { id: unknown; name: unknown; tags: unknown })
          .name === "string" &&
        typeof (preset as { id: unknown; name: unknown; tags: unknown })
          .tags === "string"
    )
    .map((preset) => ({
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
      createdAt: (() => {
        const createdAtValue: unknown = preset.createdAt;
        if (createdAtValue === null || createdAtValue === undefined) return;
        if (createdAtValue instanceof Date) return createdAtValue;
        if (typeof createdAtValue === "string") return new Date(createdAtValue);
        return;
      })(),
      updatedAt: (() => {
        const updatedAtValue: unknown = preset.updatedAt;
        if (updatedAtValue === null || updatedAtValue === undefined) return;
        if (updatedAtValue instanceof Date) return updatedAtValue;
        if (typeof updatedAtValue === "string") return new Date(updatedAtValue);
        return;
      })(),
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLoaderField(loaderData: unknown, key: string): unknown {
  return isRecord(loaderData) && key in loaderData
    ? loaderData[key]
    : undefined;
}

function parseStringRelayList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is string => typeof r === "string" && r.length > 0);
}

function parseInitialTemplateData(
  loaderData: unknown
): NewLongFormPostLoaderParsed["initialTemplateData"] {
  if (!isRecord(loaderData) || !("initialTemplateData" in loaderData)) {
    return null;
  }
  const raw = loaderData["initialTemplateData"];
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  return raw as NewLongFormPostLoaderParsed["initialTemplateData"];
}

function parseEditingMetaFromLoader(raw: unknown): ComposerEditingMeta | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("modeLabel" in raw) ||
    !("accountLabel" in raw)
  ) {
    return null;
  }
  const o = raw as { modeLabel: unknown; accountLabel: unknown };
  if (typeof o.modeLabel !== "string" || typeof o.accountLabel !== "string") {
    return null;
  }
  return raw as ComposerEditingMeta;
}

function parseTemplatesFromLoader(
  loaderData: unknown
): Array<{ id: string; name: string | null }> {
  const raw = readLoaderField(loaderData, "templates");
  return Array.isArray(raw)
    ? (raw as Array<{ id: string; name: string | null }>)
    : [];
}

/**
 * Normalizes Remix loader data for the new longform composer page.
 */
export function parseNewLongFormPostLoader(
  loaderData: unknown
): NewLongFormPostLoaderParsed {
  const userTags = readLoaderField(loaderData, "tags") ?? "";
  const scheduleIntervalsRaw = readLoaderField(loaderData, "scheduleIntervals");
  const queueTypesRaw = readLoaderField(loaderData, "queueTypes");
  const hashTagPresetsRaw = readLoaderField(loaderData, "hashTagPresets");
  const userTimezone = readLoaderField(loaderData, "userTimezone");
  const uploadProvider = readLoaderField(loaderData, "uploadProvider");
  const defaultRelays = parseStringRelayList(
    readLoaderField(loaderData, "relays")
  );
  const relaysApp = parseStringRelayList(
    readLoaderField(loaderData, "relaysApp")
  );
  const relaysNip65Profile = parseStringRelayList(
    readLoaderField(loaderData, "relaysNip65Profile")
  );

  const prs = readLoaderField(loaderData, "publishRelaySource");
  const accountPublishRelaySource: AccountPublishRelaySource =
    prs === "nip65_profile" ? "nip65_profile" : "app";

  const initialTemplateData = parseInitialTemplateData(loaderData);
  const templatesRaw = parseTemplatesFromLoader(loaderData);

  const composerContext = parseComposerContextFromLoader(
    readLoaderField(loaderData, "composerContext")
  );

  const editingMeta = parseEditingMetaFromLoader(
    readLoaderField(loaderData, "editingMeta")
  );

  const hydrationStatus =
    readLoaderField(loaderData, "hydrationStatus") === "error"
      ? ("error" as const)
      : ("ready" as const);
  const hydrationErrorRaw = readLoaderField(loaderData, "hydrationError");
  const hydrationError =
    typeof hydrationErrorRaw === "string" ? hydrationErrorRaw : null;

  return {
    userTags,
    userTimezone,
    uploadProvider,
    defaultRelays,
    relaysApp,
    relaysNip65Profile,
    accountPublishRelaySource,
    initialTemplateData,
    templatesRaw,
    scheduleIntervals: parseScheduleIntervals(scheduleIntervalsRaw),
    queueTypes: parseQueueTypes(queueTypesRaw),
    hashTagPresets: parseHashTagPresets(hashTagPresetsRaw),
    composerContext,
    editingMeta,
    hydrationStatus,
    hydrationError,
  };
}
