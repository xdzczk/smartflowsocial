import { logInfo } from "~/lib/error-logger.server";

export function trackProductEvent(
  eventName: string,
  props: Record<string, unknown> = {}
) {
  logInfo(`product_event:${eventName}`, props);
}
