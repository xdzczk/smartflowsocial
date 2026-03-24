/**
 * Pure helpers for broadcast unsubscribe tokens (testable without env).
 */

import { createHash, createHmac } from "node:crypto";

export function deriveBroadcastUnsubscribeRawToken(
  recipientId: string,
  sessionSecret: string
): string {
  return createHmac("sha256", sessionSecret)
    .update(`broadcast_unsubscribe_v1:${recipientId}`)
    .digest("hex");
}

export function hashBroadcastUnsubscribeToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function buildBroadcastUnsubscribeUrl(
  rawToken: string,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/broadcast/unsubscribe?t=${encodeURIComponent(rawToken)}`;
}
