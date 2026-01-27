/**
 * Web Push Configuration
 * Handles VAPID key generation and configuration
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- web-push uses CommonJS
const webpush = require("web-push");

/**
 * Initialize web push with VAPID keys from environment
 */
export function initWebPush(): void {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject =
    process.env["VAPID_SUBJECT"] ??
    process.env["APP_URL"] ??
    "mailto:admin@smartflow.social";

  if (!publicKey || !privateKey) {
    console.warn(
      "Web Push: VAPID keys not configured. Push notifications will be disabled."
    );
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- web-push is a CommonJS module without proper TypeScript types
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Get VAPID public key for client subscription
 */
export function getVapidPublicKey(): string | null {
  return process.env["VAPID_PUBLIC_KEY"] ?? null;
}
