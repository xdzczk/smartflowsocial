/**
 * Referral context (pre-auth) client fallback: localStorage when cookie cannot be set.
 * TTL 7 days. Server prefers cookie; this is sent as referral_context in verify body if no cookie.
 */

const REFERRAL_CONTEXT_KEY = "referral_context";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReferralContextClient {
  referrer_npub: string;
  created_at: string;
}

export function getStoredReferralContext(): ReferralContextClient | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REFERRAL_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ReferralContextClient).referrer_npub === "string" &&
      typeof (parsed as ReferralContextClient).created_at === "string"
    ) {
      const ctx = parsed as ReferralContextClient;
      const created = new Date(ctx.created_at).getTime();
      if (Number.isNaN(created) || Date.now() - created > TTL_MS) {
        localStorage.removeItem(REFERRAL_CONTEXT_KEY);
        return null;
      }
      return ctx;
    }
  } catch {
    localStorage.removeItem(REFERRAL_CONTEXT_KEY);
  }
  return null;
}

export function setStoredReferralContext(ctx: ReferralContextClient): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REFERRAL_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    // ignore
  }
}

export function clearStoredReferralContext(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REFERRAL_CONTEXT_KEY);
  } catch {
    // ignore
  }
}
