/**
 * Create a post-type template from scratch.
 * Template-only composer: only "Save as template" and Cancel.
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { UnifiedComposer } from "~/features/posts/composer";
import { loadNewPostData } from "~/features/posts/server/composer";
import {
  convertJsonValueToScheduleConfig,
  type HashTagPreset,
  type QueueType,
} from "~/features/posts/types";
import { NewPostHeader } from "~/features/posts/ui";
import { handleCreateTemplateFromScratchPost } from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";

function parseQueueType(qt: unknown): string | QueueType {
  if (typeof qt === "string") return qt;
  if (
    typeof qt === "object" &&
    qt !== null &&
    "id" in qt &&
    "name" in qt &&
    typeof qt.id === "string" &&
    typeof qt.name === "string"
  ) {
    const o = qt as { id: string; name: string; [key: string]: unknown };
    const queueType: QueueType = {
      id: o.id,
      name: o.name,
      scheduleConfig: convertJsonValueToScheduleConfig(o["scheduleConfig"]),
    };
    return queueType;
  }
  return qt as string | QueueType;
}

function parseHashTagPreset(preset: unknown): HashTagPreset | null {
  if (
    typeof preset === "object" &&
    preset !== null &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset &&
    typeof (preset as { id: unknown }).id === "string" &&
    typeof (preset as { name: unknown }).name === "string" &&
    typeof (preset as { tags: unknown }).tags === "string"
  ) {
    const p = preset as { id: string; name: string; tags: string };
    return { id: p.id, name: p.name, tags: p.tags };
  }
  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const data = await loadNewPostData(userId, null);
  return json(data);
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);
    await requireAnySubscription(userId);

    const formData = await request.formData();
    return await handleCreateTemplateFromScratchPost(userId, formData);
  }
);

export default function TemplateNewPostPage() {
  const loaderData = useLoaderData<unknown>();
  const raw = loaderData && typeof loaderData === "object" ? loaderData : {};
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
  const typedQueueTypes = queueTypesRaw.map((qt) => parseQueueType(qt));
  const typedHashTagPresets = hashTagPresetsRaw
    .map((p) => parseHashTagPreset(p))
    .filter((p): p is HashTagPreset => p !== null);

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
      <NewPostHeader />
      <UnifiedComposer
        mode="template"
        queueTypes={typedQueueTypes}
        hashTagPresets={typedHashTagPresets}
      />
    </div>
  );
}
