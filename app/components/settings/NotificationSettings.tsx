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
  pushNotificationsEnabled: initialEnabled,
  pushNotifyPublishSuccess: initialSuccess,
  pushNotifyPublishFailure: initialFailure,
}: NotificationSettingsProps) {
  const fetcher = useFetcher();
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(initialEnabled);
  const [pushNotifyPublishSuccess, setPushNotifyPublishSuccess] =
    useState(initialSuccess);
  const [pushNotifyPublishFailure, setPushNotifyPublishFailure] =
    useState(initialFailure);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getPushPermission()
  );

  const isSupported = isPushSupported();

  useEffect(() => {
    let cancelled = false;

    const checkSubscription = async () => {
      setIsChecking(true);
      const subscription = await getCurrentPushSubscription();
      if (!cancelled) {
        setIsSubscribed(!!subscription);
        setIsChecking(false);
      }
    };

    void checkSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePushNotifications = async (enabled: boolean) => {
    setPushNotificationsEnabled(enabled);

    if (enabled) {
      // Subscribe to push
      try {
        const subscription = await subscribeToPush();
        if (subscription) {
          setIsSubscribed(true);
          setPermission("granted");
        } else {
          setPushNotificationsEnabled(false);
          // Show error to user - permission might have been denied or VAPID keys not configured
          const currentPermission = getPushPermission();
          if (currentPermission === "denied") {
            setPermission("denied");
          } else {
            // VAPID keys likely not configured
            console.error(
              "Failed to subscribe to push notifications. This may be because:\n" +
                "1. VAPID keys are not configured on the server (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)\n" +
                "2. Browser permission was denied\n" +
                "3. Service worker is not registered"
            );
          }
        }
      } catch (error) {
        setPushNotificationsEnabled(false);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "Failed to subscribe to push notifications:",
          errorMessage
        );
        // If error mentions VAPID, update permission state
        if (errorMessage.includes("VAPID") || errorMessage.includes("503")) {
          // Server-side configuration issue
          console.error(
            "Push notifications are not configured on the server. Please contact support."
          );
        }
      }
    } else {
      // Unsubscribe
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        setIsSubscribed(false);
      }
    }

    // Save preference
    const formData = new FormData();
    formData.append("_action", "update_notification_preferences");
    formData.append("pushNotificationsEnabled", String(enabled));
    fetcher.submit(formData, { method: "post" });
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
                    : isSubscribed
                      ? "Subscribed and ready"
                      : permission === "denied"
                        ? "Permission denied. Please enable in browser settings."
                        : "Click to subscribe"}
                </p>
              </div>
              <Switch
                id="push-enabled"
                checked={pushNotificationsEnabled ? isSubscribed : false}
                onCheckedChange={(checked) => {
                  void handleTogglePushNotifications(checked);
                }}
                disabled={isChecking || permission === "denied"}
              />
            </div>

            {pushNotificationsEnabled && isSubscribed ? (
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
