import { randomBytes } from "crypto";

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { issueLoginChallenge } from "~/features/auth";
import { withCSRFProtection } from "~/lib/csrf";

const PURPOSE_LOGIN = "login";
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
      }

      const nonce = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

      const challenge = await issueLoginChallenge({
        nonce,
        purpose: PURPOSE_LOGIN,
        expiresAt,
      });

      return json({
        challengeId: challenge.id,
        nonce: challenge.nonce,
        purpose: challenge.purpose,
        expiresAt: challenge.expiresAt.toISOString(),
      });
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);
