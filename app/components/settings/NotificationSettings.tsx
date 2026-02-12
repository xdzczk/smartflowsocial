/**
 * Notification Settings Component
 * Manages push notification preferences
 */

import { useFetcher } from "@remix-run/react";
import { Bell, BellOff } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushSubscription,
  isPushSupported,
  getPushPermission,
} from "~/lib/push-manager.client";

interface NotificationSettingsProps {
  pushNotificationsEnabled: boolean;
  pushNotifyPublishSuccess: boolean;
  pushNotifyPublishFailure: boolean;
  pushNotifyRunwayLow: boolean;
  pushNotifyIncludePreview: boolean;
  runwayNotifyBelowDays: number | null;
}

export function NotificationSettings({
  pushNotificationsEnabled: _initialEnabled,
  pushNotifyPublishSuccess: initialSuccess,
  pushNotifyPublishFailure: initialFailure,
  pushNotifyRunwayLow: initialRunwayLow,
  pushNotifyIncludePreview: initialIncludePreview,
  runwayNotifyBelowDays: initialRunwayNotifyBelowDays,
}: NotificationSettingsProps) {
  const fetcher = useFetcher();
  const [pushNotifyPublishSuccess, setPushNotifyPublishSuccess] =
    useState(initialSuccess);
  const [pushNotifyPublishFailure, setPushNotifyPublishFailure] =
    useState(initialFailure);
  const [pushNotifyRunwayLow, setPushNotifyRunwayLow] =
    useState(initialRunwayLow);
  const [pushNotifyIncludePreview, setPushNotifyIncludePreview] = useState(
    initialIncludePreview
  );
  const [runwayNotifyBelowDays, setRunwayNotifyBelowDays] = useState<
    number | null
  >(initialRunwayNotifyBelowDays ?? null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  // Always "default" on first render to avoid server/client hydration mismatch
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [pushConfiguredOnServer, setPushConfiguredOnServer] = useState<
    boolean | null
  >(null);
  const autoSubscribeAttempted = useRef(false);
  // Only after mount do we read client-only values (avoids hydration mismatch)
  const [hasMounted, setHasMounted] = useState(false);
  const isSupported = hasMounted ? isPushSupported() : true;

  // When permission is granted but we have no subscription, subscribe (no prompt).
  const ensureSubscribedWhenGranted = useCallback(async () => {
    const currentPermission = getPushPermission();
    if (currentPermission !== "granted") return;
    const existing = await getCurrentPushSubscription();
    if (existing) return;
    if (autoSubscribeAttempted.current) return;
    autoSubscribeAttempted.current = true;
    setIsSubscribing(true);
    try {
      const subscription = await subscribeToPush();
      setPermission(getPushPermission());
      if (subscription) {
        setIsSubscribed(true);
        const formData = new FormData();
        formData.append("_action", "update_notification_preferences");
        formData.append("pushNotificationsEnabled", "true");
        fetcher.submit(formData, { method: "post" });
      }
    } catch (error) {
      console.error("Auto-subscribe for push failed:", error);
    } finally {
      setIsSubscribing(false);
    }
  }, [fetcher]);

  // Mark as mounted and sync permission (client-only after first paint to avoid hydration mismatch)
  useEffect(() => {
    setHasMounted(true);
    setPermission(getPushPermission());
  }, []);

  // Check subscription status on mount; if permission already granted but not subscribed, auto-subscribe
  useEffect(() => {
    if (!hasMounted) return;
    let cancelled = false;

    const checkSubscription = async () => {
      setIsChecking(true);
      try {
        // Probe server: is push configured (VAPID keys)?
        const probeRes = await fetch("/api/push-subscribe").catch(() => null);
        if (probeRes && !probeRes.ok) {
          cancelled = true;
          setPushConfiguredOnServer(false);
          setIsChecking(false);
          setIsSubscribed(false);
          setPermission(getPushPermission());
          return;
        }
        setPushConfiguredOnServer(probeRes?.ok ?? true);

        // Check if service worker is supported and registered
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          let registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
            // Try registering (e.g. user landed on /login first; SW is now registered in entry.client for all pages, but retry helps on first load)
            await new Promise((resolve) => setTimeout(resolve, 500));
            registration = await navigator.serviceWorker.getRegistration();
          }
          if (!registration) {
            await navigator.serviceWorker.register("/sw.js").catch(() => null);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            registration = await navigator.serviceWorker.getRegistration();
          }
          if (!registration && !cancelled) {
            console.warn(
              "Service worker not registered. Push notifications require a service worker."
            );
            cancelled = true;
            setIsChecking(false);
            const currentPermission = getPushPermission();
            setPermission(currentPermission);
            setIsSubscribed(false);
            return;
          }
        }

        const subscription = await getCurrentPushSubscription();
        const currentPermission = getPushPermission();
        if (!cancelled) {
          cancelled = true; // Prevent timeout from overwriting state
          setIsSubscribed(!!subscription);
          setPermission(currentPermission);
          setIsChecking(false);
          if (currentPermission === "granted" && !subscription) {
            void ensureSubscribedWhenGranted();
          }
        }
      } catch (error) {
        console.error("Failed to check push subscription:", error);
        if (!cancelled) {
          cancelled = true; // Prevent timeout from firing "timed out" after we already bailed
          setIsSubscribed(false);
          setPermission(getPushPermission());
          setIsChecking(false);
        }
      }
    };

    // Add timeout to prevent hanging forever
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn("Push subscription check timed out");
        setIsChecking(false);
        const currentPermission = getPushPermission();
        setPermission(currentPermission);
        setIsSubscribed(false);
      }
    }, 10000); // 10 second timeout

    void checkSubscription();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [hasMounted, ensureSubscribedWhenGranted]);

  // Monitor permission changes (e.g., user allows in browser site settings)
  useEffect(() => {
    if (
      !hasMounted ||
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      return;
    }

    const checkPermission = async () => {
      const currentPermission = getPushPermission();
      setPermission((prevPermission) => {
        if (currentPermission !== prevPermission) {
          if (currentPermission === "granted") {
            void ensureSubscribedWhenGranted();
          }
          return currentPermission;
        }
        return prevPermission;
      });
      if (currentPermission === "granted") {
        const subscription = await getCurrentPushSubscription();
        if (!subscription) {
          void ensureSubscribedWhenGranted();
        } else {
          setIsSubscribed(true);
        }
      }
    };

    void checkPermission();
    const interval = setInterval(() => {
      void checkPermission();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [hasMounted, ensureSubscribedWhenGranted]);

  // Helper function to save push notification preference to server
  const savePushPreference = useCallback(
    (enabled: boolean) => {
      const formData = new FormData();
      formData.append("_action", "update_notification_preferences");
      formData.append("pushNotificationsEnabled", String(enabled));
      fetcher.submit(formData, { method: "post" });
    },
    [fetcher]
  );

  // Helper function to poll for subscription when permission is granted
  const pollForSubscription = async (): Promise<boolean> => {
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const recheckPermission = getPushPermission();
      setPermission(recheckPermission);

      if (recheckPermission !== "granted") {
        continue;
      }

      const existingSubscription = await getCurrentPushSubscription();
      if (existingSubscription) {
        setIsSubscribed(true);
        savePushPreference(true);
        return true;
      }
    }
    return false;
  };

  // Helper function to handle successful subscription
  const handleSubscriptionSuccess = useCallback(() => {
    setIsSubscribed(true);
    savePushPreference(true);
  }, [savePushPreference]);

  // Helper function to handle subscription failure when permission is granted
  const handleSubscriptionFailureWithPermission = async (
    currentPermission: NotificationPermission
  ) => {
    if (currentPermission === "granted") {
      const found = await pollForSubscription();
      if (!found) {
        console.error(
          "Permission granted but subscription failed. This may be because:\n" +
            "1. VAPID keys are not configured on the server (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)\n" +
            "2. Service worker is not registered or not ready\n" +
            "3. Network error during subscription"
        );
      }
    } else if (currentPermission === "denied") {
      setPermission("denied");
    } else {
      console.warn("Push notification permission not granted");
    }
  };

  const handleTogglePushNotifications = async (enabled: boolean) => {
    if (isSubscribing) {
      // Prevent multiple simultaneous subscription attempts
      return;
    }

    if (enabled) {
      // Subscribe to push
      setIsSubscribing(true);

      // Safety timeout to ensure isSubscribing is always reset
      const safetyTimeout = setTimeout(() => {
        console.warn("Push subscription process timed out - resetting state");
        setIsSubscribing(false);
      }, 30000); // 30 second safety timeout

      try {
        // Check permission before subscribing (in case it was already granted)
        const initialPermission = getPushPermission();
        setPermission(initialPermission);

        const subscription = await subscribeToPush();

        // Re-check permission after subscription attempt (iOS may update it asynchronously)
        const currentPermission = getPushPermission();
        setPermission(currentPermission);

        if (subscription) {
          clearTimeout(safetyTimeout);
          handleSubscriptionSuccess();
        } else {
          clearTimeout(safetyTimeout);
          await handleSubscriptionFailureWithPermission(currentPermission);
        }
      } catch (error) {
        clearTimeout(safetyTimeout);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "Failed to subscribe to push notifications:",
          errorMessage
        );
        const currentPermission = getPushPermission();
        setPermission(currentPermission);

        // If permission was granted, check if subscription exists anyway
        if (currentPermission === "granted") {
          try {
            const existingSubscription = await getCurrentPushSubscription();
            if (existingSubscription) {
              handleSubscriptionSuccess();
            }
          } catch (checkError) {
            console.error("Failed to check existing subscription:", checkError);
          }
        }

        // If error mentions VAPID, mark server as not configured so UI shows clear message
        if (
          errorMessage.includes("VAPID") ||
          errorMessage.includes("not configured")
        ) {
          setPushConfiguredOnServer(false);
        }
      } finally {
        clearTimeout(safetyTimeout);
        setIsSubscribing(false);
      }
    } else {
      // Unsubscribe
      try {
        const subscription = await getCurrentPushSubscription();
        if (subscription) {
          await unsubscribeFromPush(subscription.endpoint);
        }
        setIsSubscribed(false);
        autoSubscribeAttempted.current = false;
        // Save preference to server
        const formData = new FormData();
        formData.append("_action", "update_notification_preferences");
        formData.append("pushNotificationsEnabled", "false");
        fetcher.submit(formData, { method: "post" });
      } catch (error) {
        console.error("Failed to unsubscribe from push notifications:", error);
        setIsSubscribed(false);
        autoSubscribeAttempted.current = false;
      }
    }
  };

  const handleToggleSuccess = (enabled: boolean) => {
    setPushNotifyPublishSuccess(enabled);
    const formData = new FormData();
    formData.append("_action", "update_notification_preferences");
    formData.append("pushNotifyPublishSuccess", String(enabled));
    fetcher.submit(formData, { method: "post" });
  };

  const handleToggleFailure = (enabled: boolean) => {
    setPushNotifyPublishFailure(enabled);
    const formData = new FormData();
    formData.append("_action", "update_notification_preferences");
    formData.append("pushNotifyPublishFailure", String(enabled));
    fetcher.submit(formData, { method: "post" });
  };

  const handleToggleRunwayLow = (enabled: boolean) => {
    setPushNotifyRunwayLow(enabled);
    const formData = new FormData();
    formData.append("_action", "update_notification_preferences");
    formData.append("pushNotifyRunwayLow", String(enabled));
    formData.append(
      "runwayNotifyBelowDays",
      runwayNotifyBelowDays !== null ? String(runwayNotifyBelowDays) : ""
    );
    fetcher.submit(formData, { method: "post" });
  };

  const handleToggleIncludePreview = (enabled: boolean) => {
    setPushNotifyIncludePreview(enabled);
    const formData = new FormData();
    formData.append("_action", "update_notification_preferences");
    formData.append("pushNotifyIncludePreview", String(enabled));
    fetcher.submit(formData, { method: "post" });
  };

  const handleRunwayNotifyBelowDaysChange = (value: number | null) => {
    setRunwayNotifyBelowDays(value ?? null);
    const formData = new FormData();
    formData.append("_action", "update_notification_preferences");
    formData.append("pushNotifyRunwayLow", String(pushNotifyRunwayLow));
    formData.append(
      "runwayNotifyBelowDays",
      value !== null ? String(value) : ""
    );
    fetcher.submit(formData, { method: "post" });
  };

  if (hasMounted && !isSupported) {
    return (
      <div className="border-border bg-card rounded-lg border p-6">
        <div className="flex items-start gap-4">
          <BellOff className="text-muted-foreground h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-foreground font-semibold">
              Push Notifications
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Push notifications are not supported in this browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <div className="flex items-start gap-4">
        <Bell className="text-foreground h-5 w-5 flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-foreground font-semibold">
              Push Notifications
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Get notified when your posts are published or fail. Enable on each
              device (e.g. this browser and your phone) to receive notifications
              everywhere.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-enabled">Enable Push Notifications</Label>
                <p className="text-muted-foreground text-xs">
                  {pushConfiguredOnServer === false
                    ? "Push notifications are not configured for this server. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."
                    : isChecking
                      ? "Checking subscription..."
                      : isSubscribing
                        ? "Subscribing..."
                        : isSubscribed
                          ? "Subscribed and ready"
                          : permission === "denied"
                            ? "Permission denied. Please enable in browser settings."
                            : "Click to subscribe"}
                </p>
              </div>
              <Switch
                id="push-enabled"
                checked={isSubscribed}
                onCheckedChange={(checked) => {
                  void handleTogglePushNotifications(checked);
                }}
                disabled={
                  pushConfiguredOnServer === false ||
                  isChecking ||
                  isSubscribing ||
                  permission === "denied"
                }
              />
            </div>

            {isSubscribed ? (
              <>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-success">
                      Notify on Publish Success
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Get notified when posts are published successfully
                    </p>
                  </div>
                  <Switch
                    id="notify-success"
                    checked={pushNotifyPublishSuccess}
                    onCheckedChange={handleToggleSuccess}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-failure">
                      Notify on Publish Failure
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Get notified when posts fail to publish (always
                      actionable)
                    </p>
                  </div>
                  <Switch
                    id="notify-failure"
                    checked={pushNotifyPublishFailure}
                    onCheckedChange={handleToggleFailure}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-include-preview">
                      Include post preview in notifications
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Show a short snippet of the post or article in publish
                      success notifications
                    </p>
                  </div>
                  <Switch
                    id="notify-include-preview"
                    checked={pushNotifyIncludePreview}
                    onCheckedChange={handleToggleIncludePreview}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-runway-low">
                      Notify when Queue Runway is Low
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Get notified when your scheduled queue has few days left
                    </p>
                  </div>
                  <Switch
                    id="notify-runway-low"
                    checked={pushNotifyRunwayLow}
                    onCheckedChange={handleToggleRunwayLow}
                  />
                </div>

                {pushNotifyRunwayLow ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="runway-notify-below-days">
                        Notify when runway is below (days)
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Use dashboard red threshold if left empty
                      </p>
                    </div>
                    <input
                      id="runway-notify-below-days"
                      type="number"
                      min={0}
                      max={365}
                      value={runwayNotifyBelowDays ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === "" ? null : parseInt(v, 10);
                        if (
                          v === "" ||
                          (Number.isInteger(n) &&
                            n !== null &&
                            n >= 0 &&
                            n <= 365)
                        ) {
                          handleRunwayNotifyBelowDaysChange(
                            v === "" ? null : n
                          );
                        }
                      }}
                      className="border-input bg-background w-20 rounded-md border px-2 py-1 text-sm"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
