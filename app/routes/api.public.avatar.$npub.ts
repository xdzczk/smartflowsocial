import type { LoaderFunctionArgs } from "@remix-run/node";

import { renderAvatar } from "~/features/public-stats/avatar.server";
import { publicStatsEnabled } from "~/features/public-stats/public-stats.server";
import { findAvatarSubject } from "~/features/public-stats/repositories/public-stats-data.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!publicStatsEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  const raw = params["npub"] ?? "";
  const candidates: string[] = [];
  if (/^npub1[0-9a-z]{20,}$/.test(raw)) {
    candidates.push(raw);
    const hex = nostrAdapter.decodeNpub(raw);
    if (hex) candidates.push(hex);
  } else if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    candidates.push(raw.toLowerCase());
  }
  for (const key of candidates) {
    const user = await findAvatarSubject(key);
    if (user) return renderAvatar(key);
  }
  return new Response("Not found", { status: 404 });
}
