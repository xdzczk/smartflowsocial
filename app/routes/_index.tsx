import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { LoginPage, getUser } from "~/features/auth";
import {
  referralContextCookie,
  serializeReferralContext,
} from "~/features/referral/referral-context.server";
import { validateAndNormalizeRefNpub } from "~/features/referral/referral-validation.server";

const CACHE_CONTROL = "no-cache, no-store, must-revalidate";

/**
 * App root: show login when not authenticated, redirect to dashboard when logged in.
 * Marketing landing lives at smartflow.social (static site).
 * Referral: on ?ref=npub1... (valid npub), set HTTP-only referral context cookie (7 days).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getUser(request);
    if (user) {
      return redirect("/dashboard", {
        headers: { "Cache-Control": CACHE_CONTROL },
      });
    }

    const url = new URL(request.url);
    const refParam = url.searchParams.get("ref");
    const referrerNpub = validateAndNormalizeRefNpub(refParam);

    const headers = new Headers();
    headers.set("Cache-Control", CACHE_CONTROL);

    if (referrerNpub) {
      const referralContext = {
        referrer_npub: referrerNpub,
        created_at: new Date().toISOString(),
      };
      const cookieValue = await referralContextCookie.serialize(
        serializeReferralContext(referralContext)
      );
      headers.append("Set-Cookie", cookieValue);
    }

    return json({}, { headers });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
};

export const meta = () => [{ title: "Login" }];

export default LoginPage;
