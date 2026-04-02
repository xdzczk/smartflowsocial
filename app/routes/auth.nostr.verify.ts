import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { validateEvent } from "nostr-tools";

import {
  consumeLoginChallengeAndCreateSession,
  getLoginChallengeForVerify,
} from "~/features/auth";
import {
  getCompleteProfile,
  LOGIN_FLOW_PRIMAL_FETCH_BUDGET_MS,
} from "~/features/auth/profile.server";
import { getSession, sessionStorage } from "~/features/auth/session.server";
import {
  getReferralContextFromCookie,
  parseReferralContext,
  referralContextCookie,
} from "~/features/referral/referral-context.server";
import { brandLoginChallengeTitle } from "~/lib/brand";
import { withCSRFProtection } from "~/lib/csrf";
import { AuthenticationError, ValidationError } from "~/lib/errors";
import { featureFlags } from "~/lib/feature-flags.server";

const PURPOSE_LOGIN = "login";
const LOGIN_EVENT_KIND = 27235;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PROFILE_REFRESH_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function isHexPubkey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value.trim());
}

function canonicalLoginMessage(input: {
  nonce: string;
  expiresAtIso: string;
}): string {
  return [
    brandLoginChallengeTitle,
    "",
    `Nonce: ${input.nonce}`,
    "Purpose: login",
    `Expires: ${input.expiresAtIso}`,
  ].join("\n");
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
      }

      if (!featureFlags.nostrAuthV2Enabled) {
        return json(
          {
            success: false,
            error: {
              code: "FEATURE_DISABLED",
              message:
                "Nostr auth is disabled on this server (NOSTR_AUTH_V2_ENABLED=false).",
            },
          },
          { status: 404 }
        );
      }

      let bodyRaw: unknown;
      try {
        bodyRaw = await request.json();
      } catch (error) {
        throw new ValidationError("Invalid JSON in request body", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }

      const body =
        typeof bodyRaw === "object" && bodyRaw !== null
          ? (bodyRaw as {
              challengeId?: unknown;
              pubkey?: unknown;
              signedEvent?: unknown;
              redirectTo?: unknown;
              referral_context?: unknown;
            })
          : {};

      const challengeId =
        typeof body.challengeId === "string" ? body.challengeId : "";

      if (!challengeId) {
        throw new ValidationError("Missing challengeId");
      }
      if (!isHexPubkey(body.pubkey)) {
        throw new ValidationError("Missing or invalid pubkey");
      }
      if (body.signedEvent === null || body.signedEvent === undefined) {
        throw new ValidationError("Missing signedEvent");
      }

      const pubkey = body.pubkey.trim();

      // Load challenge
      const challenge = await getLoginChallengeForVerify({ id: challengeId });

      if (challenge?.purpose !== PURPOSE_LOGIN) {
        throw new ValidationError("Challenge not found");
      }
      if (challenge.consumedAt) {
        throw new ValidationError("Challenge already consumed");
      }
      if (challenge.expiresAt.getTime() <= Date.now()) {
        throw new ValidationError("Challenge expired");
      }

      // Verify signed event
      const signedEventUnknown: unknown = body.signedEvent;
      if (
        typeof signedEventUnknown !== "object" ||
        signedEventUnknown === null
      ) {
        throw new ValidationError("Invalid signedEvent");
      }
      const signedEvent = signedEventUnknown as Record<string, unknown>;

      const eventPubkey =
        typeof signedEvent["pubkey"] === "string" ? signedEvent["pubkey"] : "";
      const eventKind =
        typeof signedEvent["kind"] === "number"
          ? signedEvent["kind"]
          : undefined;
      const eventContent =
        typeof signedEvent["content"] === "string"
          ? signedEvent["content"]
          : "";

      if (eventPubkey !== pubkey) {
        throw new AuthenticationError("Pubkey mismatch", {
          pubkey,
          eventPubkey,
        });
      }
      if (eventKind !== LOGIN_EVENT_KIND) {
        throw new AuthenticationError("Invalid event kind", { eventKind });
      }

      const expectedContent = canonicalLoginMessage({
        nonce: challenge.nonce,
        expiresAtIso: challenge.expiresAt.toISOString(),
      });

      if (eventContent !== expectedContent) {
        throw new AuthenticationError("Invalid signature content");
      }

      const isValid = validateEvent(signedEvent);
      if (!isValid) {
        throw new AuthenticationError("Invalid signature");
      }

      // Fetch profile outside the DB transaction (network-bound, best-effort).
      // Do not block login on Primal retries/timeouts (can exceed 45s).
      const { nostrProfile } = await getCompleteProfile({
        npub: pubkey,
        primalFetchBudgetMs: LOGIN_FLOW_PRIMAL_FETCH_BUDGET_MS,
      });
      const profileJson = JSON.stringify(nostrProfile);

      // Referral context: cookie first, then body (client may send from localStorage)
      let referralContext = await getReferralContextFromCookie(request);
      if (!referralContext && body.referral_context != null) {
        const fromBody =
          typeof body.referral_context === "string"
            ? parseReferralContext(body.referral_context)
            : null;
        if (fromBody) referralContext = fromBody;
      }

      // Consume challenge (race-safe) + create session + referral binding in a transaction
      const sessionId = await consumeLoginChallengeAndCreateSession({
        challengeId,
        pubkey,
        profileJson,
        sessionTtlMs: SESSION_TTL_MS,
        profileRefreshTtlMs: PROFILE_REFRESH_TTL_MS,
        referralContext: referralContext ?? undefined,
      });

      const cookieSession = await getSession(request);
      cookieSession.set("sessionId", sessionId);

      const sessionCookie = await sessionStorage.commitSession(cookieSession, {
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });

      // Clear referral context cookie after binding (post-binding cleanup)
      const clearReferralCookie = await referralContextCookie.serialize("", {
        maxAge: 0,
      });

      const headers = new Headers();
      headers.append("Set-Cookie", sessionCookie);
      headers.append("Set-Cookie", clearReferralCookie);

      return json(
        {
          success: true,
          redirectTo: "/dashboard",
          sessionId,
          pubkey,
        },
        { headers }
      );
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);
