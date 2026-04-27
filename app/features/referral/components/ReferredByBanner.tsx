import { useCallback, useEffect, useState } from "react";

import { formatNpubShort } from "~/lib/nostr-conversion";

const REFERRAL_THANKYOU_COOKIE = "referral_thankyou_shown";
const COOKIE_MAX_AGE_DAYS = 365;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match?.[2] != null ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export interface ReferredByBannerProps {
  referrerNpub: string;
  referrerDisplayName: string | null;
}

function getShouldShowReferralBanner(): boolean {
  if (typeof document === "undefined") return false;
  return !getCookie(REFERRAL_THANKYOU_COOKIE);
}

export function ReferredByBanner({
  referrerNpub,
  referrerDisplayName,
}: ReferredByBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldShow(getShouldShowReferralBanner());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    setCookie(REFERRAL_THANKYOU_COOKIE, "1");
    setDismissed(true);
    setShouldShow(false);
  }, []);

  if (!shouldShow || dismissed) return null;

  const display = referrerDisplayName ?? formatNpubShort(referrerNpub);
  const profileUrl = `https://njump.me/${referrerNpub}`;

  return (
    <div className="max-w-page mx-auto w-full px-4 pt-4 sm:px-6 lg:px-8">
      <div
        className="border-border-subtle bg-surface-hover/30 mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
        role="status"
      >
        <p className="text-text-secondary">
          You were referred by <strong className="text-text">{display}</strong>.
          This supports the operator who invited you.{" "}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:text-link-hover hover:underline"
          >
            View profile
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-text-secondary hover:text-text shrink-0 rounded-xs p-1"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
