import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireSession } from "~/features/auth";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import type { SignedEvent } from "~/features/nostr/types";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import {
  getFeedbackInboxPubkeyHex,
  validateUserSignedFeedbackDm,
  validateUserSignedFeedbackGiftWrap,
} from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";
import { featureFlags } from "~/lib/feature-flags.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import {
  giftWrapRecipientPubkeyHex,
  relaysForNip17GiftWrap,
  resolveCachedKind10050InboxRelays,
  resolveDmRelaysSafe,
} from "~/lib/nostr.messenger.server";
import { checkProductFeedbackRateLimit } from "~/lib/rate-limit.server";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

function mergeRelayListsForFeedbackDm(
  userRelays: string[],
  inboxDmRelays: string[],
  cap: number
): string[] {
  const merged = Array.from(
    new Set(
      [...userRelays, ...inboxDmRelays].map((r) => r.trim()).filter(Boolean)
    )
  );
  return merged.slice(0, cap);
}

function parseGiftWrapsFromBody(body: {
  giftWraps?: unknown;
}): unknown[] | null {
  const gw = body.giftWraps;
  if (gw === undefined || gw === null) {
    return null;
  }
  if (!Array.isArray(gw)) {
    return [];
  }
  return gw;
}

async function validateOptionalFeedbackGiftWraps(params: {
  giftWrapsRaw: unknown[] | null;
  inboxHex: string;
  sessionPubkey: string;
}): Promise<
  | { ok: true; giftWraps: SignedEvent[]; feedbackInbox10050Relays: string[] }
  | { ok: false; response: Response }
> {
  const { giftWrapsRaw, inboxHex, sessionPubkey } = params;

  if (giftWrapsRaw === null) {
    return {
      ok: true,
      giftWraps: [],
      feedbackInbox10050Relays: [],
    };
  }

  if (giftWrapsRaw.length === 0) {
    return {
      ok: false,
      response: json({ error: "Invalid giftWraps payload." }, { status: 400 }),
    };
  }

  if (!featureFlags.nostrDmNip17Enabled) {
    return {
      ok: false,
      response: json(
        { error: "NIP-17 gift wraps are disabled on this server." },
        { status: 400 }
      ),
    };
  }

  const feedbackInbox10050Relays =
    await resolveCachedKind10050InboxRelays(inboxHex);
  if (feedbackInbox10050Relays.length === 0) {
    return {
      ok: false,
      response: json(
        {
          error:
            "Feedback inbox has no kind:10050 inbox relays; omit giftWraps.",
        },
        { status: 400 }
      ),
    };
  }

  if (giftWrapsRaw.length !== 2) {
    return {
      ok: false,
      response: json(
        { error: "Expected exactly two NIP-17 gift wraps." },
        { status: 400 }
      ),
    };
  }

  const giftWraps: SignedEvent[] = [];
  for (const gwUnknown of giftWrapsRaw) {
    const gw = validateSignedEventCryptographically(gwUnknown);
    const wrapCheck = validateUserSignedFeedbackGiftWrap({
      event: gw,
      inboxHexLower: inboxHex,
      sessionPubkey,
    });
    if (!wrapCheck.ok) {
      return {
        ok: false,
        response: json({ error: wrapCheck.error }, { status: 400 }),
      };
    }
    giftWraps.push(gw);
  }

  return { ok: true, giftWraps, feedbackInbox10050Relays };
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
      }

      const inboxHex = getFeedbackInboxPubkeyHex();
      if (!inboxHex) {
        return json({ error: "Feedback is not configured." }, { status: 503 });
      }

      let bodyRaw: unknown;
      try {
        bodyRaw = await request.json();
      } catch {
        return json({ error: "Invalid JSON body." }, { status: 400 });
      }

      const body =
        typeof bodyRaw === "object" && bodyRaw !== null
          ? (bodyRaw as { event?: unknown; giftWraps?: unknown })
          : {};
      const eventUnknown = body.event;
      const giftWrapsRaw = parseGiftWrapsFromBody(body);

      if (eventUnknown === null || eventUnknown === undefined) {
        return json({ error: "Signed event is required." }, { status: 400 });
      }

      const session = await requireSession(request);

      const rate = await checkProductFeedbackRateLimit(session.userId);
      if (!rate.allowed) {
        return json(
          { error: rate.error ?? "Too many submissions. Try again later." },
          { status: 429 }
        );
      }

      const validatedKind4 = validateSignedEventCryptographically(eventUnknown);

      assertSignedEventMatchesSessionPubkey({
        sessionPubkey: session.pubkey,
        eventPubkey: validatedKind4.pubkey,
        context: { route: "/api/feedback-dm" },
      });

      const dmCheck = validateUserSignedFeedbackDm({
        event: validatedKind4,
        inboxHexLower: inboxHex,
        sessionPubkey: session.pubkey,
      });
      if (!dmCheck.ok) {
        return json({ error: dmCheck.error }, { status: 400 });
      }

      const giftWrapOutcome = await validateOptionalFeedbackGiftWraps({
        giftWrapsRaw,
        inboxHex,
        sessionPubkey: session.pubkey,
      });
      if (!giftWrapOutcome.ok) {
        return giftWrapOutcome.response;
      }
      const { giftWraps: giftWrapsValidated, feedbackInbox10050Relays } =
        giftWrapOutcome;

      const [userRelays, inboxDmRelays] = await Promise.all([
        resolveExecutionRelays(session.userId),
        resolveDmRelaysSafe(inboxHex),
      ]);
      const kind4Relays = mergeRelayListsForFeedbackDm(
        userRelays,
        inboxDmRelays,
        24
      );

      await publishSignedEventToRelays({
        signedEvent: validatedKind4,
        relays: kind4Relays,
        correlationId: `feedback-dm:${validatedKind4.id}`,
      });

      for (const gw of giftWrapsValidated) {
        const pTag = giftWrapRecipientPubkeyHex(gw);
        if (!pTag) {
          return json({ error: "Gift wrap missing p tag." }, { status: 400 });
        }
        const wrapRelays = await relaysForNip17GiftWrap({
          giftWrapPTag: pTag,
          receiverHexLower: inboxHex,
          recipientInboxRelays: feedbackInbox10050Relays,
          senderHexLower: session.pubkey.toLowerCase(),
        });
        await publishSignedEventToRelays({
          signedEvent: gw,
          relays: wrapRelays.length > 0 ? wrapRelays : kind4Relays,
          correlationId: `feedback-dm:nip17:${gw.id}`,
        });
      }

      return json({ success: true });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      if (error instanceof ValidationError) {
        return json({ error: error.message }, { status: 400 });
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);
