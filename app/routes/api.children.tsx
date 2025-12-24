import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getUserSubscription } from "~/models/payment.server";
import { getConfirmedChildrenForParent, getUserBasicInfo } from "~/models/user.server";

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
  } catch { }
  return { name: undefined, display_name: undefined, picture: undefined } as const;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Fetch minimal user info
  const me = await getUserBasicInfo(userId);
  if (!me?.npub) {
    return json({ children: [] });
  }
  // Only parents can fetch children
  if (me.isChild) {
    return json({ children: [] });
  }

  // Check subscription plan is Premium or Founder
  const sub = await getUserSubscription(userId);
  const planId = (sub?.planId || "").toLowerCase();
  const planName = (sub?.Plan?.name || "").toLowerCase();
  const hasAccountsAccess = planId === "premium" || planName === "premium" || planName === "founder";
  if (!hasAccountsAccess) {
    return json({ children: [] });
  }

  const confirmed = await getConfirmedChildrenForParent(me.npub);
  const children = confirmed.map((c) => {
    const bits = extractProfileBits(c.nostrProfile);
    return {
      npub: c.npub,
      name: bits.name,
      displayName: bits.display_name,
      picture: bits.picture,
    };
  });

  return json({ children });
}
