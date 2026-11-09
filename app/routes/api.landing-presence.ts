import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { dropAvatarCache } from "~/features/public-stats/avatar.server";
import { bustPublicStatsCache } from "~/features/public-stats/public-stats.server";
import {
  findLandingPresence,
  markLandingNoticeSeen,
  setLandingVisibility,
} from "~/features/public-stats/repositories/public-stats-data.server";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await findLandingPresence(userId);
  if (!user) return json({ error: "Not found" }, { status: 404 });
  return json({
    hideFromLanding: user.hideFromLanding,
    showNotice: !user.hideFromLanding && user.landingNoticeSeenAt == null,
  });
}

async function apply(userId: string, formData: FormData): Promise<Response> {
  const intent = formData.get("intent");
  const user = await findLandingPresence(userId);
  if (!user) return json({ error: "Not found" }, { status: 404 });

  if (intent === "dismiss") {
    await markLandingNoticeSeen(userId);
    return json({ ok: true });
  }

  if (intent === "visibility") {
    const hide = formData.get("hideFromLanding") === "true";
    await setLandingVisibility(userId, hide);
    await dropAvatarCache(user.npub);
    await bustPublicStatsCache();
    return json({ ok: true, hideFromLanding: hide });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);
    return apply(userId, await request.formData());
  }
);
