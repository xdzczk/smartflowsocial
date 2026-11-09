import type { LoaderFunctionArgs } from "@remix-run/node";

import { renderAvatar } from "~/features/public-stats/avatar.server";
import { publicStatsEnabled } from "~/features/public-stats/public-stats.server";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!publicStatsEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  const npub = params["npub"] ?? "";
  if (!/^npub1[0-9a-z]{20,}$/.test(npub)) {
    return new Response("Not found", { status: 404 });
  }
  return renderAvatar(npub);
}
