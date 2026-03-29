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
        const userIdVal = typeof q.userId === "string" ? q.userId : "";
        const includeRaw = (q as { includeHashtagsInNoteBody?: unknown })
          .includeHashtagsInNoteBody;
        const result: QueueType = {
          id,
          name,
          color,
          colorToken: colorToken ?? undefined,
          description: undefined,
          scheduleType: scheduleType,
          scheduleConfig:
            scheduleConfig as unknown as QueueType["scheduleConfig"],
          isEnabled: isEnabled,
          userId: userIdVal,
          includeHashtagsInNoteBody:
            typeof includeRaw === "boolean" ? includeRaw : undefined,
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

/**
 * Normalizes Remix loader data for the new longform composer page.
 */
export function parseNewLongFormPostLoader(
  loaderData: unknown
): NewLongFormPostLoaderParsed {
  const userTags =
    loaderData && typeof loaderData === "object" && "tags" in loaderData
      ? (loaderData as { tags?: unknown }).tags
      : "";
  const scheduleIntervalsRaw =
    loaderData &&
    typeof loaderData === "object" &&
    "scheduleIntervals" in loaderData
      ? (loaderData as { scheduleIntervals?: unknown }).scheduleIntervals
      : null;
  const queueTypesRaw =
    loaderData && typeof loaderData === "object" && "queueTypes" in loaderData
      ? (loaderData as { queueTypes?: unknown }).queueTypes
      : [];
  const hashTagPresetsRaw =
    loaderData &&
    typeof loaderData === "object" &&
    "hashTagPresets" in loaderData
      ? (loaderData as { hashTagPresets?: unknown }).hashTagPresets
      : [];
  const userTimezone =
    loaderData && typeof loaderData === "object" && "userTimezone" in loaderData
      ? (loaderData as { userTimezone?: unknown }).userTimezone
      : null;
  const uploadProvider =
    loaderData &&
    typeof loaderData === "object" &&
    "uploadProvider" in loaderData
      ? (loaderData as { uploadProvider?: unknown }).uploadProvider
      : null;
  const relaysRaw =
    loaderData && typeof loaderData === "object" && "relays" in loaderData
      ? (loaderData as { relays?: unknown }).relays
      : [];
  const defaultRelays = Array.isArray(relaysRaw)
    ? relaysRaw.filter(
        (r): r is string => typeof r === "string" && r.length > 0
      )
    : [];

  const relaysAppRaw =
    loaderData && typeof loaderData === "object" && "relaysApp" in loaderData
      ? (loaderData as { relaysApp?: unknown }).relaysApp
      : [];
  const relaysApp = Array.isArray(relaysAppRaw)
    ? relaysAppRaw.filter(
        (r): r is string => typeof r === "string" && r.length > 0
      )
    : [];

  const relaysNip65Raw =
    loaderData &&
    typeof loaderData === "object" &&
    "relaysNip65Profile" in loaderData
      ? (loaderData as { relaysNip65Profile?: unknown }).relaysNip65Profile
      : [];
  const relaysNip65Profile = Array.isArray(relaysNip65Raw)
    ? relaysNip65Raw.filter(
        (r): r is string => typeof r === "string" && r.length > 0
      )
    : [];

  const prs = (loaderData as { publishRelaySource?: unknown } | null)
    ?.publishRelaySource;
  const accountPublishRelaySource: AccountPublishRelaySource =
    prs === "nip65_profile" ? "nip65_profile" : "app";
  const initialTemplateData =
    loaderData &&
    typeof loaderData === "object" &&
    "initialTemplateData" in loaderData &&
    (loaderData as { initialTemplateData?: unknown }).initialTemplateData !==
      null &&
    typeof (loaderData as { initialTemplateData?: unknown })
      .initialTemplateData === "object"
      ? (
          loaderData as {
            initialTemplateData: {
              title?: string;
              summary?: string;
              content?: string;
              image?: string;
              tags?: string[];
              queueType?: { name: string };
            };
          }
        ).initialTemplateData
      : null;
  const templatesRaw =
    loaderData &&
    typeof loaderData === "object" &&
    "templates" in loaderData &&
    Array.isArray((loaderData as { templates?: unknown }).templates)
      ? (
          loaderData as {
            templates: Array<{ id: string; name: string | null }>;
          }
        ).templates
      : [];

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
  };
}
