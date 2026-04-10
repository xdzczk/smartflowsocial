import { BRAND_NAME } from "~/lib/brand";

export function scheduleCapExceededMessage(limit: number): string {
  return `Your plan includes up to ${limit} scheduled items. Upgrade to schedule more.`;
}

export function queueCapExceededMessage(limit: number): string {
  const label = limit === 1 ? "queue" : "queues";
  return `Your plan includes up to ${limit} ${label}. Upgrade to create and manage more.`;
}

export function draftCapExceededMessage(limit: number): string {
  return `Your plan includes up to ${limit} drafts. Upgrade to save more.`;
}

export function templateCapExceededMessage(limit: number): string {
  return `Your plan includes up to ${limit} templates. Upgrade to save more.`;
}

export function broadcastSendBlockedMessage(): string {
  return "You can explore broadcasts on Free. Sending broadcasts requires a paid plan.";
}

export function bulkBlockedMessage(): string {
  return "Bulk workflows start on Creator.";
}

export function sfsBlossomBlockedMessage(): string {
  return `${BRAND_NAME}-hosted media storage is available on paid plans.`;
}
