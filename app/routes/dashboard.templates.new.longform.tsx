/**
 * Create a longform-type template from scratch.
 * Template-only composer: blueprint rail (no publish / relay selection).
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { LongFormPost } from "~/features/posts/longform";
import {
  convertJsonValueToScheduleConfig,
  type HashTagPreset,
  type QueueType,
} from "~/features/posts/server";
import { loadNewLongFormData } from "~/features/posts/server/longform";
import { getQueueAccentHex } from "~/features/posts/ui";
import { handleCreateTemplateFromScratchLongform } from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const data = await loadNewLongFormData(userId);
  return json(data);
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);
    await requireAnySubscription(userId);

    const formData = await request.formData();
    const actionType = formData.get("_action");
    if (actionType === "createTemplate") {
      return await handleCreateTemplateFromScratchLongform(userId, formData);
    }
    return json({ error: "Unknown action" }, { status: 400 });
  }
);

function parseLoaderData(loaderData: unknown) {
  const raw = loaderData && typeof loaderData === "object" ? loaderData : {};
  const scheduleIntervalsRaw = Array.isArray(
    (raw as { scheduleIntervals?: unknown }).scheduleIntervals
  )
    ? (raw as { scheduleIntervals: unknown[] }).scheduleIntervals
    : [];
  const queueTypesRaw = Array.isArray(
    (raw as { queueTypes?: unknown }).queueTypes
  )
    ? (raw as { queueTypes: unknown[] }).queueTypes
    : [];
  const hashTagPresetsRaw = Array.isArray(
    (raw as { hashTagPresets?: unknown }).hashTagPresets
  )
    ? (raw as { hashTagPresets: unknown[] }).hashTagPresets
    : [];
  const scheduleIntervals = scheduleIntervalsRaw
    .map((s: unknown) => {
      if (typeof s === "string") {
        const parsed = parseFloat(s);
        return Number.isNaN(parsed) ? null : parsed;
      }
      if (typeof s === "number") return s;
      return null;
    })
    .filter((n): n is number => n !== null);

  const queueTypes: QueueType[] = queueTypesRaw
    .map((qt: unknown): QueueType | null => {
      if (qt && typeof qt === "object" && "id" in qt && "name" in qt) {
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
          q.colorToken != null && typeof q.colorToken === "string"
            ? q.colorToken
            : null;
        const scheduleType =
          typeof q.scheduleType === "string" &&
          ["INTERVAL", "FIXED_SLOTS", "WEEKLY_SLOTS"].includes(q.scheduleType)
            ? (q.scheduleType as "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS")
            : undefined;
        const scheduleConfig = convertJsonValueToScheduleConfig(
          q.scheduleConfig
        );
        const isEnabled =
          typeof q.isEnabled === "boolean"
            ? q.isEnabled
            : q.isEnabled !== false;
        const userIdVal = typeof q.userId === "string" ? q.userId : "";
        const item: QueueType = {
          id,
          name,
          color,
          colorToken: colorToken ?? undefined,
          description: undefined,
          scheduleType,
          scheduleConfig: scheduleConfig,
          isEnabled,
          userId: userIdVal,
        };
        return item;
      }
      return null;
    })
    .filter((qt): qt is QueueType => qt !== null);

  const hashTagPresets: HashTagPreset[] = hashTagPresetsRaw
    .filter(
      (preset: unknown): preset is { id: string; name: string; tags: string } =>
        typeof preset === "object" &&
        preset !== null &&
        "id" in preset &&
        "name" in preset &&
        "tags" in preset &&
        typeof (preset as { id: unknown }).id === "string" &&
        typeof (preset as { name: unknown }).name === "string" &&
        typeof (preset as { tags: unknown }).tags === "string"
    )
    .map((preset) => ({
      id: preset.id,
      name: preset.name,
      tags: preset.tags,
    }));

  const userTags =
    typeof (raw as { tags?: unknown }).tags === "string"
      ? (raw as { tags: string }).tags
      : "";
  const userTimezone =
    typeof (raw as { userTimezone?: unknown }).userTimezone === "string"
      ? (raw as { userTimezone: string }).userTimezone
      : "Etc/GMT";
  const uploadProvider = (raw as { uploadProvider?: unknown }).uploadProvider;
  const uploadProviderStr =
    typeof uploadProvider === "string" || uploadProvider === null
      ? uploadProvider
      : null;

  return {
    queueTypes,
    scheduleIntervals,
    hashTagPresets,
    userTags,
    userTimezone,
    uploadProvider: uploadProviderStr,
  };
}

export default function TemplateNewLongformPage() {
  const loaderData = useLoaderData<unknown>();
  const {
    queueTypes,
    scheduleIntervals,
    hashTagPresets,
    userTags,
    userTimezone,
    uploadProvider,
  } = parseLoaderData(loaderData);

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link
          to="/dashboard/templates"
          className="text-link hover:text-link-hover dark:text-text-secondary dark:hover:text-text text-sm"
        >
          ← Back to Templates
        </Link>
      </div>
      <LongFormPost
        mode="template"
        queueTypes={queueTypes}
        scheduleIntervals={scheduleIntervals}
        userTags={userTags}
        userTimezone={userTimezone}
        uploadProvider={uploadProvider}
        hashTagPresets={hashTagPresets}
        onPreview={() => {}}
        defaultRelays={[]}
      />
    </div>
  );
}
