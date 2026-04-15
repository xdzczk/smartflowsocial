import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { logInfo, logWarning } from "~/lib/error-logger.server";

interface WebVitalMetric {
  name: string;
  value: number;
  id?: string;
  path?: string;
  rating?: string;
}

function toWebVitalMetric(value: unknown): WebVitalMetric | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate["name"] !== "string" ||
    typeof candidate["value"] !== "number"
  ) {
    return null;
  }

  return {
    name: candidate["name"],
    value: candidate["value"],
    id: typeof candidate["id"] === "string" ? candidate["id"] : undefined,
    path: typeof candidate["path"] === "string" ? candidate["path"] : undefined,
    rating:
      typeof candidate["rating"] === "string" ? candidate["rating"] : undefined,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const rawBody: unknown = await request.json();
    const metric = toWebVitalMetric(rawBody);
    if (!metric) {
      return json({ error: "Invalid metric payload" }, { status: 400 });
    }

    logInfo("web-vital", {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      path: metric.path,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return json({ ok: true });
  } catch (error) {
    logWarning("web-vital-ingest-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }
}
