import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getUserBasicInfo, getUserByNpubWithProfile } from "~/models/user.server";

function extractProfileBits(nostrProfile: any | null | undefined) {
  if (!nostrProfile) return { name: undefined, display_name: undefined, picture: undefined } as const;
  try {
    if (typeof nostrProfile === "string") {
      const p = JSON.parse(nostrProfile);
      return { name: p?.name, display_name: p?.display_name, picture: p?.picture } as const;
    }
    if (typeof nostrProfile === "object") {
      const p: any = nostrProfile;
      return { name: p?.name, display_name: p?.display_name, picture: p?.picture } as const;
    }
  } catch {
    // Silently ignore parse errors - return defaults
  }
  return { name: undefined, display_name: undefined, picture: undefined } as const;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const me = await getUserBasicInfo(userId);
    if (!me?.isChild || !me.parentNpub) {
      return json({ parent: null });
    }
    const parent = await getUserByNpubWithProfile(me.parentNpub);
    if (!parent) return json({ parent: null });
    const bits = extractProfileBits(parent.nostrProfile);
    return json({ parent: { npub: parent.npub, name: bits.name, displayName: bits.display_name, picture: bits.picture } });
  } catch (error) {
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, { parent: null });
  }
}

