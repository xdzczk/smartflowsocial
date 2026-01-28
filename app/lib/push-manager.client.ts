/**
 * Push Manager Client
 * Handles push notification subscription management
 */

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Request push notification permission
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported");
  }

  return await Notification.requestPermission();
}

/**
 * Get current push notification permission
 */
export function getPushPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Subscribe to push notifications
 * IMPORTANT: Permission must be requested first (while the user gesture is still valid).
 * If we await serviceWorker.ready or fetch() before requesting permission, the browser
 * may not show the system prompt.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn("Push notifications are not supported");
    return null;
  }

  try {
    // Request permission FIRST - must happen during the user gesture or the prompt won't show
    const permission = await requestPushPermission();
    if (permission !== "granted") {
      console.warn("Push notification permission denied");
      return null;
    }

    // Now get service worker registration (after we have permission)
    // Add timeout to prevent hanging if service worker never becomes ready
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      10000, // 10 second timeout
      "Service worker did not become ready within 10 seconds"
    );

    // Get VAPID public key from server with timeout
    const response = await withTimeout(
      fetch("/api/push-subscribe"),
      10000, // 10 second timeout
      "Failed to get VAPID public key: Request timed out"
    );

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const errorMessage =
        errorData.error ?? `Server returned ${response.status}`;
      throw new Error(`Failed to get VAPID public key: ${errorMessage}`);
    }
    const data = (await response.json()) as {
      publicKey?: string;
      error?: string;
    };
    if (data.error || !data.publicKey) {
      throw new Error(
        data.error ?? "VAPID public key not available from server"
      );
    }
    const { publicKey } = data;

    if (!publicKey) {
      throw new Error("VAPID public key not available");
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // Subscribe to push with timeout
    const subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      }),
      10000, // 10 second timeout
      "Push subscription timed out"
    );

    // Extract subscription details
    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");

    const subscriptionData: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: p256dhKey ? arrayBufferToBase64(p256dhKey) : "",
        auth: authKey ? arrayBufferToBase64(authKey) : "",
      },
    };

    // Send subscription to server with timeout
    const subscribeResponse = await withTimeout(
      fetch("/api/push-subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscriptionData),
      }),
      10000, // 10 second timeout
      "Failed to save subscription: Request timed out"
    );

    if (!subscribeResponse.ok) {
      const errorText = await subscribeResponse.text().catch(() => "");
      throw new Error(
        `Failed to save subscription: ${subscribeResponse.status} ${errorText}`
      );
    }

    return subscriptionData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to subscribe to push notifications:", errorMessage);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(endpoint: string): Promise<boolean> {
  try {
    // Unsubscribe from push manager
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription?.endpoint === endpoint) {
      await subscription.unsubscribe();
    }

    // Remove from server
    const response = await fetch("/api/push-unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to unsubscribe from push notifications:", error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return null;
    }

    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: p256dhKey ? arrayBufferToBase64(p256dhKey) : "",
        auth: authKey ? arrayBufferToBase64(authKey) : "",
      },
    };
  } catch (error) {
    console.error("Failed to get push subscription:", error);
    return null;
  }
}

/**
 * Convert URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) {
    return "";
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return window.btoa(binary);
}
