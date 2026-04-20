import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useEffect } from "react";

import { BRAND_NAME } from "~/lib/brand";
import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) =>
  buildSeoMeta(
    {
      page: "Signer connected",
      description: `Your remote signer has approved the request. Return to ${BRAND_NAME} to continue.`,
      robots: "noindex, nofollow",
    },
    { siteOrigin: siteOriginFromMatches(matches) }
  );

const BROADCAST_CHANNEL_NAME = "smartflow-signer-callback";

/**
 * Dedicated landing page that Primal Signer (and other NIP-46 signer
 * apps that respect the `nostrconnect://?callback=` parameter) returns
 * the user to after approving a sign-in.
 *
 * Why this route exists at a different URL from the sign-in page:
 *
 * On iOS, when a NIP-46 signer app navigates to a callback URL, Safari
 * decides whether to focus an existing tab (URL match) or open a new
 * one (no match). Pointing the callback at the sign-in page itself
 * (`window.location.origin + window.location.pathname + ...`) makes
 * Safari refocus the existing tab, and that page-lifecycle transition
 * (hidden -> visible via inter-app URL handoff with bfcache eligibility)
 * has a documented WebKit race that can drop the queued NIP-46 reply
 * frame on the WebSocket — silently. The relay forwarded it, the OS
 * received it, but it never reaches JS. That manifested as the strict
 * 50/50 alternating "bunker:get_public_key timeout" we saw on Primal
 * Signer + iPhone.
 *
 * Pointing the callback at this dedicated URL — which by definition
 * doesn't match the sign-in tab's URL — makes Safari open a new tab
 * for the callback, leaving the original sign-in tab undisturbed in
 * the background where its WebSocket continues to buffer Primal's
 * reply normally. When the user switches back, the buffered reply is
 * delivered and the sign-in completes. This mirrors Ditto, where the
 * same handoff lands on a separate tab and sign-in is reliable.
 *
 * The page is intentionally tiny (no app shell, no auth context, no
 * data loaders) so it loads quickly on first paint inside whatever
 * fresh Safari tab Primal opens, even on a cold network.
 *
 * Best-effort `BroadcastChannel` ping: if the original sign-in tab is
 * still alive in the same browser session, it can listen on
 * `smartflow-signer-callback` to short-circuit any "waiting for
 * approval" UI. The actual sign-in completes via the relay regardless
 * of whether the broadcast lands; this is purely a UX nicety.
 */
export default function SignerCallback() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof BroadcastChannel !== "function") return;
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: "signer-callback", at: Date.now() });
    } catch {
      // No-op; the WebSocket-side completion path doesn't depend on this.
    } finally {
      try {
        channel?.close();
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <main className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <div className="bg-muted text-muted-foreground mb-6 flex h-14 w-14 items-center justify-center rounded-full">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground h-7 w-7"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
        Signer connected
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm sm:text-base">
        Your remote signer approved the request. You can close this tab and
        return to {BRAND_NAME} to finish signing in.
      </p>
      <Link
        to="/"
        className="text-foreground mt-6 text-sm underline-offset-4 hover:underline"
      >
        Open {BRAND_NAME}
      </Link>
    </main>
  );
}
