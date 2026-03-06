/**
 * Referral context (pre-auth): cookie storage and validation.
 * TTL 7 days; contents { referrer_npub, created_at }.
 */

import { createCookie } from "@remix-run/node";

const REFERRAL_CONTEXT_TTL_DAYS = 7;
const REFERRAL_CONTEXT_MAX_AGE_SEC = REFERRAL_CONTEXT_TTL_DAYS * 24 * 60 * 60;

export const referralContextCookie = createCookie("referral_context", {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  maxAge: REFERRAL_CONTEXT_MAX_AGE_SEC,
  secrets: process.env["SESSION_SECRET"] ? [process.env["SESSION_SECRET"]] : [],
  secure: process.env["NODE_ENV"] === "production",
});

export interface ReferralContext {
  referrer_npub: string;
  created_at: string; // ISO
}

const REFERRAL_CONTEXT_COOKIE_MAX_AGE_MS =
  REFERRAL_CONTEXT_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isReferralContextExpired(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isNaN(t) || Date.now() - t > REFERRAL_CONTEXT_COOKIE_MAX_AGE_MS;
}

export function parseReferralContext(
  value: string | null
): ReferralContext | null {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ReferralContext).referrer_npub === "string" &&
      typeof (parsed as ReferralContext).created_at === "string"
    ) {
      const ctx = parsed as ReferralContext;
      if (isReferralContextExpired(ctx.created_at)) return null;
      return ctx;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getReferralContextFromCookie(
  request: Request
): Promise<ReferralContext | null> {
  const cookieHeader = request.headers.get("Cookie");
  const raw: unknown = await referralContextCookie.parse(cookieHeader);
  const value = typeof raw === "string" ? raw : null;
  return parseReferralContext(value);
}

export function serializeReferralContext(ctx: ReferralContext): string {
  return JSON.stringify({
    referrer_npub: ctx.referrer_npub,
    created_at: ctx.created_at,
  });
}
