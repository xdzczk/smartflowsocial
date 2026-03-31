import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { z } from "zod";

import { requireUserId } from "~/features/auth";
import {
  findUserBroadcastSettings,
  updateUserBroadcastSettings,
} from "~/features/broadcast/repositories/broadcast-settings-data.server";
import { requireAnySubscription } from "~/features/payments";

const settingsSchema = z.object({
  defaultDeliveryMode: z.string().optional(),
  defaultSendStrategy: z.string().optional(),
  failurePausePercent: z.coerce.number().min(0).max(100).optional(),
  minDaysBetweenRemessage: z.coerce.number().min(0).max(365).optional(),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const raw = await findUserBroadcastSettings(userId);
  const settings =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return json({ settings });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const form = await request.formData();
  const parsed = settingsSchema.safeParse({
    defaultDeliveryMode: form.get("defaultDeliveryMode") ?? undefined,
    defaultSendStrategy: form.get("defaultSendStrategy") ?? undefined,
    failurePausePercent: form.get("failurePausePercent") ?? undefined,
    minDaysBetweenRemessage: form.get("minDaysBetweenRemessage") ?? undefined,
  });
  if (!parsed.success) {
    return json({ error: "Invalid settings" }, { status: 400 });
  }

  await updateUserBroadcastSettings(userId, parsed.data);
  return redirect("/dashboard/broadcasts/settings");
}

export default function BroadcastSettingsRoute() {
  const { settings } = useLoaderData<typeof loader>();

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Broadcast settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Defaults for new campaigns (plan limits still apply).
        </p>
      </div>

      <Form method="post" className="max-w-xl space-y-4">
        <div>
          <label
            htmlFor="broadcast-default-delivery"
            className="mb-1 block text-sm font-medium"
          >
            Default delivery mode
          </label>
          <select
            id="broadcast-default-delivery"
            name="defaultDeliveryMode"
            defaultValue={String(
              settings["defaultDeliveryMode"] ?? "BEST_COMPATIBILITY"
            )}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="BEST_COMPATIBILITY">Best compatibility</option>
            <option value="NIP04_ONLY">NIP-04 only</option>
            <option value="NIP17_ONLY">NIP-17 only</option>
            <option value="NIP17_FALLBACK_NIP04">NIP-17 then NIP-04</option>
            <option value="BOTH">Expert: send both</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="broadcast-default-strategy"
            className="mb-1 block text-sm font-medium"
          >
            Default send strategy
          </label>
          <select
            id="broadcast-default-strategy"
            name="defaultSendStrategy"
            defaultValue={String(settings["defaultSendStrategy"] ?? "STANDARD")}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="STANDARD">Standard</option>
            <option value="STAGGERED">Staggered</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="broadcast-failure-pause"
            className="mb-1 block text-sm font-medium"
          >
            Pause campaign if failure rate exceeds (%)
          </label>
          <input
            id="broadcast-failure-pause"
            type="number"
            name="failurePausePercent"
            min={0}
            max={100}
            defaultValue={String(settings["failurePausePercent"] ?? 50)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="broadcast-min-days-remessage"
            className="mb-1 block text-sm font-medium"
          >
            Min days before re-messaging same recipient (future)
          </label>
          <input
            id="broadcast-min-days-remessage"
            type="number"
            name="minDaysBetweenRemessage"
            min={0}
            max={365}
            defaultValue={String(settings["minDaysBetweenRemessage"] ?? 7)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Save
        </button>
      </Form>
    </div>
  );
}
