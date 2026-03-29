import { useRevalidator, useRouteLoaderData } from "@remix-run/react";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  BTCPAY_CONFIRMATION_WATCH_STORAGE_KEY,
  clearBtcpayConfirmationWatch,
  readBtcpayConfirmationWatch,
} from "~/features/payments/btcpay-confirmation-watch-storage";
import type { PaymentStatusPayload } from "~/features/payments/hooks/usePaymentPolling";

function syncWatchFromStorage(): ReturnType<
  typeof readBtcpayConfirmationWatch
> {
  const w = readBtcpayConfirmationWatch();
  if (!w) return null;
  if (new Date(w.expiresAt).getTime() <= Date.now()) {
    clearBtcpayConfirmationWatch();
    return null;
  }
  return w;
}

/**
 * Slim banner when the user closed the BTCPay invoice modal after a 0-conf payment
 * was detected; keeps polling until the first on-chain confirmation completes access.
 */
export function BtcpayConfirmationWatchBar() {
  const loaderData = useRouteLoaderData("root");
  const user =
    loaderData &&
    typeof loaderData === "object" &&
    "user" in loaderData &&
    loaderData.user &&
    typeof loaderData.user === "object" &&
    "id" in loaderData.user &&
    typeof (loaderData.user as { id: unknown }).id === "string"
      ? (loaderData.user as { id: string })
      : null;
  const revalidator = useRevalidator();

  const [storageEpoch, setStorageEpoch] = useState(0);
  const bumpStorageRead = useCallback(() => {
    setStorageEpoch((n) => n + 1);
  }, []);

  const watch = useMemo(() => {
    if (!user) return null;
    void storageEpoch;
    return syncWatchFromStorage();
  }, [user, storageEpoch]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const cls = "has-btcpay-confirmation-bar";
    if (!watch || !user) {
      document.body.classList.remove(cls);
      return;
    }
    document.body.classList.add(cls);
    return () => {
      document.body.classList.remove(cls);
    };
  }, [watch, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === BTCPAY_CONFIRMATION_WATCH_STORAGE_KEY) {
        bumpStorageRead();
      }
    };
    const onCustom = () => {
      bumpStorageRead();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("smartflow:btcpay-confirmation-watch", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "smartflow:btcpay-confirmation-watch",
        onCustom
      );
    };
  }, [bumpStorageRead]);

  useEffect(() => {
    if (!watch || !user) return;

    const cancelledRef = { current: false };

    const poll = async () => {
      const formData = new FormData();
      formData.append("paymentId", watch.paymentId);
      let response: Response;
      try {
        response = await fetch("/api/payment-status", {
          method: "POST",
          body: formData,
        });
      } catch {
        return;
      }

      if (cancelledRef.current) return;

      if (response.status === 401 || response.status === 403) {
        clearBtcpayConfirmationWatch();
        return;
      }

      if (response.status === 404) {
        clearBtcpayConfirmationWatch();
        return;
      }

      if (!response.ok) return;

      let data: PaymentStatusPayload;
      try {
        data = (await response.json()) as PaymentStatusPayload;
      } catch {
        return;
      }

      if (data.success && data.paid) {
        clearBtcpayConfirmationWatch();
        toast.success("Bitcoin payment confirmed — your plan is active.");
        revalidator.revalidate();
        return;
      }

      if (data.status === "EXPIRED") {
        clearBtcpayConfirmationWatch();
        toast.error(
          "That checkout expired. Start a new payment from Plans if needed."
        );
      }
    };

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 10_000);

    return () => {
      cancelledRef.current = true;
      window.clearInterval(id);
    };
  }, [watch, user, revalidator]);

  if (!user || !watch) return null;

  return (
    <div
      className="border-border fixed top-0 right-0 left-0 z-[100] border-b bg-amber-950/90 px-3 py-2 text-amber-50 shadow-md backdrop-blur-sm dark:bg-amber-950/80"
      role="status"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 text-center text-sm">
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-amber-200"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-amber-50/95">
          Bitcoin payment seen — waiting for the first on-chain confirmation.
          Your plan activates after one block. You can keep using the app; we
          will update automatically.
        </p>
        <button
          type="button"
          onClick={() => {
            clearBtcpayConfirmationWatch();
          }}
          className="shrink-0 rounded p-1 text-amber-200 hover:text-amber-50 focus:ring-2 focus:ring-amber-300 focus:outline-none"
          aria-label="Dismiss payment status bar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
