/** Pure helpers for the public marketing stats. No I/O. */

export const PEOPLE_LIMIT = 48;
export const ON_TIME_WINDOW_MS = 10 * 60 * 1000;

export interface PublicPerson {
  npub: string;
  name: string;
  picture: string;
}

export interface PublicStats {
  v: 1;
  generated_at: string;
  posts_published_total: number;
  posts_published_30d: number;
  posts_scheduled_now: number;
  reposts_scheduled_total: number;
  /** Null when nothing with both a scheduled time and a publish time exists in the window. */
  on_time_rate_30d: number | null;
  active_accounts_30d: number;
  running_since: string | null;
  people: PublicPerson[];
}

export interface ProfileBits {
  name: string | null;
  picture: string | null;
}

export function profileBits(raw: unknown): ProfileBits {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { name: null, picture: null };
    }
  }
  if (!value || typeof value !== "object") {
    return { name: null, picture: null };
  }
  const record = value as Record<string, unknown>;
  const nested =
    record["profile"] && typeof record["profile"] === "object"
      ? (record["profile"] as Record<string, unknown>)
      : record;
  const display =
    typeof nested["display_name"] === "string"
      ? nested["display_name"].trim()
      : "";
  const name = typeof nested["name"] === "string" ? nested["name"].trim() : "";
  const picture =
    typeof nested["picture"] === "string" ? nested["picture"].trim() : "";
  return {
    name: display || name || null,
    picture:
      picture.startsWith("http://") || picture.startsWith("https://")
        ? picture
        : null,
  };
}

export function shortenNpub(npub: string): string {
  if (npub.length <= 16) return npub;
  return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
}

export interface PersonCandidate {
  userId: string;
  publishedAt: Date;
  npub: string;
  profile: unknown;
}

/** Most recently published first, one row per account, only accounts with a picture. */
export function selectPeople(
  rows: PersonCandidate[],
  limit = PEOPLE_LIMIT
): Array<{ npub: string; name: string }> {
  const ordered = [...rows].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  const seen = new Set<string>();
  const people: Array<{ npub: string; name: string }> = [];
  for (const row of ordered) {
    if (seen.has(row.userId)) continue;
    const bits = profileBits(row.profile);
    if (!bits.picture) continue;
    seen.add(row.userId);
    people.push({ npub: row.npub, name: bits.name ?? shortenNpub(row.npub) });
    if (people.length >= limit) break;
  }
  return people;
}

export function onTimeRate(
  rows: Array<{ publishedAt: Date; scheduledAtUtc: Date }>,
  windowMs = ON_TIME_WINDOW_MS
): number | null {
  if (rows.length === 0) return null;
  const onTime = rows.filter(
    (row) =>
      Math.abs(row.publishedAt.getTime() - row.scheduledAtUtc.getTime()) <=
      windowMs
  ).length;
  return Math.round((onTime / rows.length) * 1000) / 1000;
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === undefined || b === undefined) return false;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Rejects non-http(s) URLs and hosts that point at the local network. */
export function safeImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return null;
  }
  if (isPrivateIpv4(host)) return null;
  if (
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  ) {
    return null;
  }
  return url;
}
