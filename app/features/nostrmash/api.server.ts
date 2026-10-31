import { env } from "~/lib/env.server";

import {
  parseAuthorPage,
  parseCounts,
  parseEventLookup,
  type AuthorPage,
  type AuthorStream,
  type EventCountsSnapshot,
  type EventLookup,
} from "./parse";

const ANALYTICS_TIMEOUT_MS = 8_000;
const READ_TIMEOUT_MS = 2_000;
const MAX_BODY_CHARS = 2_000_000;
const PAGE_LIMIT = 100;

export interface NostrMashAnalyticsClient {
  listAuthorPage(
    pubkey: string,
    stream: AuthorStream,
    cursor: string | null
  ): Promise<AuthorPage | null>;
  lookupEvent(eventId: string): Promise<EventLookup>;
  readCounts(eventId: string): Promise<EventCountsSnapshot | null>;
}

export function nostrmashBaseUrl(): string {
  const configured = env.NOSTRMASH_BASE_URL?.trim();
  const base =
    configured && configured.length > 0
      ? configured
      : "https://api.nostrmash.com";
  return base.replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = env.NOSTRMASH_API_TOKEN?.trim();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function nostrmashRequest(
  path: string,
  init: { method?: string; body?: string; timeoutMs: number }
): Promise<{ status: number; body: unknown } | null> {
  const base = nostrmashBaseUrl();
  if (!base.startsWith("http://") && !base.startsWith("https://")) return null;
  try {
    const response = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      body: init.body,
      signal: AbortSignal.timeout(init.timeoutMs),
      headers: {
        ...authHeaders(),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const text = await response.text();
    if (text.length > MAX_BODY_CHARS) return null;
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    }
    return { status: response.status, body };
  } catch {
    return null;
  }
}

function authorPath(
  pubkey: string,
  stream: AuthorStream,
  cursor: string | null
): string {
  const encoded = encodeURIComponent(pubkey);
  if (stream === "replies") {
    return `/api/v1/authors/${encoded}/replies?limit=${PAGE_LIMIT}`;
  }
  const kind = stream === "longform" ? 30023 : 1;
  const params = new URLSearchParams({
    kind: String(kind),
    limit: String(PAGE_LIMIT),
  });
  if (cursor) params.set("cursor", cursor);
  return `/api/v1/authors/${encoded}/events?${params.toString()}`;
}

export function createNostrMashAnalyticsClient(): NostrMashAnalyticsClient {
  return {
    async listAuthorPage(pubkey, stream, cursor) {
      const response = await nostrmashRequest(
        authorPath(pubkey, stream, cursor),
        { timeoutMs: ANALYTICS_TIMEOUT_MS }
      );
      if (response?.status !== 200) return null;
      return parseAuthorPage(response.body);
    },
    async lookupEvent(eventId) {
      const response = await nostrmashRequest(
        `/api/v1/events/${encodeURIComponent(eventId)}`,
        { timeoutMs: ANALYTICS_TIMEOUT_MS }
      );
      if (!response) return { status: "error" };
      return parseEventLookup(response.status, response.body);
    },
    async readCounts(eventId) {
      const response = await nostrmashRequest(
        `/api/v1/events/${encodeURIComponent(eventId)}/counts`,
        { timeoutMs: ANALYTICS_TIMEOUT_MS }
      );
      if (response?.status !== 200) return null;
      return parseCounts(response.body);
    },
  };
}

export async function nostrmashRead(
  path: string,
  init?: { method?: string; body?: string }
): Promise<{ status: number; body: unknown } | null> {
  return nostrmashRequest(path, {
    method: init?.method,
    body: init?.body,
    timeoutMs: READ_TIMEOUT_MS,
  });
}
