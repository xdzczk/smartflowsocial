/**
 * Detect if the app is running as a PWA in standalone display mode (opened from home screen).
 * No .client suffix so this runs in both server and client bundles (safe for SSR).
 * On the server, returns false.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari: Add to Home Screen opens in standalone mode
  if ((navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}
