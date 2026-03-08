/**
 * Builds "View note/article/profile" links for the user's preferred Nostr client.
 * Per-client path patterns:
 * - Primal/Amethyst/Nostur: /e/{hex}, /a/{id}, /p/{npub}
 * - Damus: /{nevent}, /{naddr}, /{npub}
 * - noStrudel: /n/{nevent} for notes, /articles/{naddr} for articles
 * - Yakihonne: /note/{nevent} for notes, /article/{naddr} for articles
 * - Iris: /{note1} for notes and articles (when event id is hex)
 */

import { nip19 } from "nostr-tools";

export type PreferredNostrClientPreset =
  | "PRIMAL"
  | "DAMUS"
  | "AMETHYST"
  | "NOSTUR"
  | "NOSTRUDEL"
  | "IRIS"
  | "YAKIHONNE"
  | "CUSTOM";

export type NostrClientPathStyle =
  | "primal"
  | "bech32_bare"
  | "nostrudel"
  | "yakihonne"
  | "iris";

export interface NostrClientConfig {
  baseUrl: string;
  pathStyle: NostrClientPathStyle;
}

const PRESET_CONFIG: Record<
  Exclude<PreferredNostrClientPreset, "CUSTOM">,
  { baseUrl: string; pathStyle: NostrClientPathStyle }
> = {
  PRIMAL: { baseUrl: "https://primal.net", pathStyle: "primal" },
  DAMUS: { baseUrl: "https://damus.io", pathStyle: "bech32_bare" },
  AMETHYST: { baseUrl: "https://amethyst.social", pathStyle: "primal" },
  NOSTUR: { baseUrl: "https://nostur.com", pathStyle: "primal" },
  NOSTRUDEL: { baseUrl: "https://nostrudel.ninja", pathStyle: "nostrudel" },
  IRIS: { baseUrl: "https://iris.to", pathStyle: "iris" },
  YAKIHONNE: { baseUrl: "https://yakihonne.com", pathStyle: "yakihonne" },
};

const FALLBACK_CONFIG: NostrClientConfig = {
  baseUrl: "https://primal.net",
  pathStyle: "primal",
};

/**
 * Resolves config for the user's preferred Nostr client.
 * Invalid or missing config falls back to Primal.
 */
export function getNostrClientConfig(
  preferredNostrClient: string | null | undefined,
  customNostrClientBaseUrl?: string | null
): NostrClientConfig {
  if (!preferredNostrClient || preferredNostrClient === "CUSTOM") {
    const url =
      typeof customNostrClientBaseUrl === "string"
        ? customNostrClientBaseUrl.trim()
        : "";
    if (preferredNostrClient === "CUSTOM" && url !== "") {
      try {
        const parsed = new URL(url);
        const base = `${parsed.protocol}//${parsed.host}`;
        return { baseUrl: base, pathStyle: "primal" };
      } catch {
        return FALLBACK_CONFIG;
      }
    }
    return FALLBACK_CONFIG;
  }
  const preset =
    PRESET_CONFIG[preferredNostrClient as keyof typeof PRESET_CONFIG];
  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- preset undefined when key not in PRESET_CONFIG */
  return preset ?? FALLBACK_CONFIG;
}

function normalizeHexId(hex: string): string {
  const raw = hex.trim();
  return raw.toLowerCase().startsWith("0x") ? raw.slice(2) : raw;
}

/**
 * Builds a URL to view a note/event in the preferred client.
 * eventIdHex: event id in hex (64 chars).
 */
export function eventUrl(
  eventIdHex: string,
  config: NostrClientConfig
): string {
  if (!eventIdHex || typeof eventIdHex !== "string") return "";
  const base = config.baseUrl.replace(/\/$/, "");
  const hex = normalizeHexId(eventIdHex);
  try {
    switch (config.pathStyle) {
      case "bech32_bare":
        return `${base}/${nip19.neventEncode({ id: hex })}`;
      case "nostrudel":
        return `${base}/n/${nip19.neventEncode({ id: hex })}`;
      case "yakihonne":
        return `${base}/note/${nip19.neventEncode({ id: hex })}`;
      case "iris":
        return `${base}/${nip19.noteEncode(hex)}`;
      case "primal":
      default:
        return `${base}/e/${hex}`;
    }
  } catch {
    return `${base}/e/${hex}`;
  }
}

/** True if string looks like a 64-char hex event id (optional 0x). */
function isHexEventId(s: string): boolean {
  const h = normalizeHexId(s);
  return /^[0-9a-f]{64}$/i.test(h);
}

/**
 * Builds a URL to view an article (long-form) in the preferred client.
 * idOrNaddr: event id (hex) or naddr1... bech32.
 * - noStrudel: /articles/{naddr}
 * - Yakihonne: /article/{naddr}
 * - Iris: /{note1} when given hex event id; else /a/{idOrNaddr}
 */
export function articleUrl(
  idOrNaddr: string,
  config: NostrClientConfig
): string {
  if (!idOrNaddr || typeof idOrNaddr !== "string") return "";
  const base = config.baseUrl.replace(/\/$/, "");
  const raw = idOrNaddr.trim();
  switch (config.pathStyle) {
    case "bech32_bare":
      if (raw.startsWith("naddr1")) return `${base}/${raw}`;
      return `${base}/a/${raw}`;
    case "nostrudel":
      return `${base}/articles/${raw}`;
    case "yakihonne":
      return `${base}/article/${raw}`;
    case "iris":
      if (isHexEventId(raw)) {
        try {
          return `${base}/${nip19.noteEncode(normalizeHexId(raw))}`;
        } catch {
          return `${base}/a/${raw}`;
        }
      }
      return `${base}/a/${raw}`;
    case "primal":
    default:
      return `${base}/a/${raw}`;
  }
}

/**
 * Builds a URL to view a profile in the preferred client.
 * npub: bech32 npub (npub1...).
 */
export function profileUrl(npub: string, config: NostrClientConfig): string {
  if (!npub || typeof npub !== "string") return "";
  const base = config.baseUrl.replace(/\/$/, "");
  const raw = npub.trim();
  if (config.pathStyle === "bech32_bare" && raw.startsWith("npub1")) {
    return `${base}/${raw}`;
  }
  return `${base}/p/${raw}`;
}

/**
 * Display name for the client (for "View on {name}" labels).
 */
export function getNostrClientDisplayName(
  preferredNostrClient: string | null | undefined
): string {
  const names: Record<string, string> = {
    PRIMAL: "Primal",
    DAMUS: "Damus",
    AMETHYST: "Amethyst",
    NOSTUR: "Nostur",
    NOSTRUDEL: "noStrudel",
    IRIS: "Iris",
    YAKIHONNE: "Yakihonne",
    CUSTOM: "client",
  };
  return names[String(preferredNostrClient)] ?? "Primal";
}

/** User shape from root loader (minimal for URL builder). */
export interface RootUserNostrClientPreference {
  preferredNostrClient?: string | null;
  customNostrClientBaseUrl?: string | null;
}

/**
 * Build config and URL helpers from root loader user. Use in components that need
 * to build event/article/profile URLs. Pass rootData?.user from useRouteLoaderData("root").
 */
export function getNostrClientUrlsFromUser(
  rootUser: RootUserNostrClientPreference | null | undefined
) {
  const config = getNostrClientConfig(
    rootUser?.preferredNostrClient,
    rootUser?.customNostrClientBaseUrl
  );
  const viewEventLabel = getNostrClientDisplayName(
    rootUser?.preferredNostrClient
  );
  return {
    config,
    viewEventLabel,
    eventUrl: (eventId: string) => eventUrl(eventId, config),
    articleUrl: (idOrNaddr: string) => articleUrl(idOrNaddr, config),
    profileUrl: (npub: string) => profileUrl(npub, config),
  };
}
