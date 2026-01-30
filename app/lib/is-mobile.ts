/**
 * Detect if we're on a mobile device (iOS or Android).
 * No .client suffix so this runs in both server and client bundles (required for
 * NostrLoginPanel SSR when redirecting back from Primal - isMobile() is called during render).
 * On the server, returns false.
 */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
  );
}
