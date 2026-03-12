/**
 * Remote signer sessions: app detection and URI masking.
 * Pure helpers; depend only on ActiveSignerConfig type.
 */

import type { ActiveSignerConfig } from "./nostr-signer-storage.client";

function detectAppFromHostname(hostname: string): string | null {
  const lowerHostname = hostname.toLowerCase();
  if (lowerHostname.includes("primal")) {
    return "Primal";
  }
  if (lowerHostname.includes("damus")) {
    return "Damus";
  }
  if (lowerHostname.includes("amethyst")) {
    return "Amethyst";
  }
  if (lowerHostname.includes("snort")) {
    return "Snort";
  }
  return null;
}

function detectFromBunkerInput(bunkerInput: string): string | null {
  try {
    const url = new URL(bunkerInput);
    return detectAppFromHostname(url.hostname);
  } catch {
    return null;
  }
}

function detectFromNostrConnectUri(
  uri: string,
  relays: string[]
): string | null {
  try {
    const url = new URL(uri);
    const name = url.searchParams.get("name");
    if (name) {
      return name;
    }

    for (const relay of relays) {
      const appName = detectAppFromHostname(relay);
      if (appName) {
        return appName;
      }
    }
  } catch {
    // continue
  }
  return null;
}

export function detectSignerAppName(config: ActiveSignerConfig): string | null {
  if (config.type === "nip07") {
    return "Browser Extension";
  }

  if (config.method === "bunker_input") {
    return detectFromBunkerInput(config.bunkerInput);
  }
  return detectFromNostrConnectUri(config.uri, config.relays);
}

export function maskConnectionUri(uri: string): string {
  if (uri.length <= 50) {
    return uri;
  }
  return `${uri.slice(0, 20)}...${uri.slice(-10)}`;
}
