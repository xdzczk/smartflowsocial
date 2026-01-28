/**
 * Notification Settings Component
 * Manages push notification preferences
 */

import { BellIcon, BellSlashIcon } from "@heroicons/react/20/solid";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { Label } from "~/components/ui/label";
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
}

export function NotificationSettings({
  pushNotificationsEnabled: _initialEnabled,
  pushNotifyPublishSuccess: initialSuccess,
  pushNotifyPublishFailure: initialFailure,
}: NotificationSettingsProps) {
  const fetcher = useFetcher();
  const [pushNotifyPublishSuccess, setPushNotifyPublishSuccess] =
    useState(initialSuccess);
  const [pushNotifyPublishFailure, setPushNotifyPublishFailure] =
    useState(initialFailure);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  // Use lazy initializer to safely get permission on client side only
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    return getPushPermission();
  });

  const isSupported = isPushSupported();

  // Check subscription status on mount and when permission changes
  useEffect(() => {
    let cancelled = false;

    const checkSubscription = async () => {
      setIsChecking(true);
      const subscription = await getCurrentPushSubscription();
      const currentPermission = getPushPermission();
      if (!cancelled) {
        setIsSubscribed(!!subscription);
        setPermission(currentPermission);
        setIsChecking(false);
      }
    };

    void checkSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  // Monitor permission changes (e.g., user grants permission in OS settings)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    // Check permission periodically to catch changes made outside the app
    const checkPermission = () => {
      const currentPermission = getPushPermission();
      setPermission((prevPermission) => {
        if (currentPermission !== prevPermission) {
          // If permission was granted, re-check subscription
          if (currentPermission === "granted") {
            void (async () => {
              const subscription = await getCurrentPushSubscription();
              setIsSubscribed(!!subscription);
            })();
          }
          return currentPermission;
        }
        return prevPermission;
      });
    };

    // Check immediately
    checkPermission();

    // Check periodically (every 2 seconds) to catch permission changes
    const interval = setInterval(checkPermission, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleTogglePushNotifications = async (enabled: boolean) => {
    if (isSubscribing) {
      // Prevent multiple simultaneous subscription attempts
      return;
    }

    if (enabled) {
      // Subscribe to push
      setIsSubscribing(true);
      try {
        const subscription = await subscribeToPush();
        const currentPermission = getPushPermission();
        setPermission(currentPermission);

        if (subscription) {
          setIsSubscribed(true);
          // Save preference to server
          const formData = new FormData();
          formData.append("_action", "update_notification_preferences");
          formData.append("pushNotificationsEnabled", "true");
          fetcher.submit(formData, { method: "post" });
        } else {
          // Subscription failed - check why
          if (currentPermission === "denied") {
            setPermission("denied");
          } else {
            // VAPID keys likely not configured or other issue
            console.error(
              "Failed to subscribe to push notifications. This may be because:\n" +
                "1. VAPID keys are not configured on the server (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)\n" +
                "2. Browser permission was denied\n" +
                "3. Service worker is not registered"
            );
          }
          // Don't update pushNotificationsEnabled - let the toggle reflect the actual state
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "Failed to subscribe to push notifications:",
          errorMessage
        );
        const currentPermission = getPushPermission();
        setPermission(currentPermission);
        // If error mentions VAPID, update permission state
        if (errorMessage.includes("VAPID") || errorMessage.includes("503")) {
          // Server-side configuration issue
          console.error(
            "Push notifications are not configured on the server. Please contact support."
          );
        }
        // Don't update pushNotificationsEnabled - let the toggle reflect the actual state
      } finally {
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
        // Save preference to server
        const formData = new FormData();
        formData.append("_action", "update_notification_preferences");
        formData.append("pushNotificationsEnabled", "false");
        fetcher.submit(formData, { method: "post" });
      } catch (error) {
        console.error("Failed to unsubscribe from push notifications:", error);
        // On error, still update local state to reflect user intent
        setIsSubscribed(false);
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

  if (!isSupported) {
    return (
      <div className="border-border bg-card rounded-lg border p-6">
        <div className="flex items-start gap-4">
          <BellSlashIcon className="text-muted-foreground h-5 w-5 flex-shrink-0" />
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
        <BellIcon className="text-foreground h-5 w-5 flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-foreground font-semibold">
              Push Notifications
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Get notified when your posts are published or fail.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-enabled">Enable Push Notifications</Label>
                <p className="text-muted-foreground text-xs">
                  {isChecking
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
                  isChecking || isSubscribing || permission === "denied"
                }
              />
            </div>

            {isSubscribed ? (
              <>
                <div className="border-border border-t pt-4" />
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
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
