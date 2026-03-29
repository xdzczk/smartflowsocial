import { useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
const PAYMENT_ID_FIELD = "paymentId";

/** Lightning: fast; 5 minutes is plenty. */
export const PAYMENT_POLL_DEFAULT_MAX_MS = 5 * 60 * 1000;
export const PAYMENT_POLL_DEFAULT_INTERVAL_MS = 5_000;

/** On-chain BTCPay: first confirm is often 10+ minutes; keep polling until invoice expiry window. */
export const PAYMENT_POLL_BTCPAY_MAX_MS = 24 * 60 * 60 * 1000;
export const PAYMENT_POLL_BTCPAY_INTERVAL_MS = 10_000;

export interface PaymentStatusPayload {
  success?: boolean;
  paid?: boolean;
  btcpayAwaitingConfirmations?: boolean;
  status?: string;
}

interface UsePaymentPollingProps {
  paymentId: string | null;
  onPaymentComplete: () => void;
  /** When true, do not redirect after a successful payment (e.g. giveaway finalization). */
  skipSuccessNavigation?: boolean;
  /** Stop polling after this duration (default: Lightning-friendly 5 minutes). */
  maxPollingDurationMs?: number;
  /** Delay between status checks (default 5s). */
  pollingIntervalMs?: number;
  /** Called after each successful `/api/payment-status` parse (modal + BTCPay banner). */
  onPaymentStatusPayload?: (payload: PaymentStatusPayload) => void;
}

/**
 * Custom hook for managing payment polling
 */
export function usePaymentPolling({
  paymentId: _paymentId,
  onPaymentComplete,
  skipSuccessNavigation = false,
  maxPollingDurationMs = PAYMENT_POLL_DEFAULT_MAX_MS,
  pollingIntervalMs = PAYMENT_POLL_DEFAULT_INTERVAL_MS,
  onPaymentStatusPayload,
}: UsePaymentPollingProps) {
  const navigate = useNavigate();
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const shouldStopPolling = useRef(false);
  const maxPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMaxPollTimeout = useCallback(() => {
    if (maxPollTimeoutRef.current) {
      clearTimeout(maxPollTimeoutRef.current);
      maxPollTimeoutRef.current = null;
    }
  }, []);

  // Function to check payment status immediately
  const checkPaymentStatusNow = async (paymentId: string) => {
    try {
      const formData = new FormData();
      formData.append(PAYMENT_ID_FIELD, paymentId);

      const response = await fetch("/api/payment-status", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        return;
      }

      const responseText = await response.text();
      let data: PaymentStatusPayload;
      try {
        data = JSON.parse(responseText) as PaymentStatusPayload;
      } catch (_parseError) {
        return;
      }

      onPaymentStatusPayload?.(data);

      if (data.success && data.paid) {
        clearMaxPollTimeout();
        shouldStopPolling.current = true;
        setIsPolling(false);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        onPaymentComplete();
        if (!skipSuccessNavigation) {
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 2000);
        }
      }
    } catch (_error) {
      // Silently handle errors
    }
  };

  // Start automatic payment polling
  const startPaymentPolling = useCallback(
    (paymentId: string) => {
      clearMaxPollTimeout();
      // Clear any existing interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }

      // Don't start if already polling
      if (isPolling) {
        return;
      }

      // Reset the stopping ref
      shouldStopPolling.current = false;
      setIsPolling(true);

      const interval = setInterval(() => {
        if (shouldStopPolling.current) {
          clearInterval(interval);
          return;
        }

        void (async () => {
          try {
            const formData = new FormData();
            formData.append(PAYMENT_ID_FIELD, paymentId);

            const response = await fetch("/api/payment-status", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              return;
            }

            const responseText = await response.text();
            let data: PaymentStatusPayload;
            try {
              data = JSON.parse(responseText) as PaymentStatusPayload;
            } catch (_parseError) {
              return;
            }

            onPaymentStatusPayload?.(data);

            if (data.success && data.paid) {
              clearMaxPollTimeout();
              // Stop this specific interval immediately
              clearInterval(interval);
              setPollingInterval(null);
              setIsPolling(false);
              shouldStopPolling.current = true;
              onPaymentComplete();

              // Also clear the stored interval reference to prevent any issues
              if (pollingInterval && pollingInterval !== interval) {
                clearInterval(pollingInterval);
              }

              if (!skipSuccessNavigation) {
                setTimeout(() => {
                  navigate("/dashboard", { replace: true });
                }, 2000);
              }
            }
          } catch (_error) {
            // Silently handle polling errors
          }
        })();
      }, pollingIntervalMs);

      setPollingInterval(interval);

      maxPollTimeoutRef.current = setTimeout(() => {
        maxPollTimeoutRef.current = null;
        shouldStopPolling.current = true;
        clearInterval(interval);
        setPollingInterval(null);
        setIsPolling(false);
      }, maxPollingDurationMs);
    },
    [
      clearMaxPollTimeout,
      isPolling,
      maxPollingDurationMs,
      navigate,
      onPaymentComplete,
      onPaymentStatusPayload,
      pollingInterval,
      pollingIntervalMs,
      skipSuccessNavigation,
    ]
  );

  // Clean up polling on component unmount only. Do NOT set shouldStopPolling
  // here when deps change: when pollingInterval goes from null to a new
  // interval, running the previous cleanup would set shouldStopPolling=true
  // and the next interval tick would exit without fetching (no payment-status
  // requests visible in Network tab).
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    intervalRef.current = pollingInterval;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollingInterval]);

  useEffect(() => {
    return () => {
      clearMaxPollTimeout();
    };
  }, [clearMaxPollTimeout]);

  return {
    isPolling,
    startPaymentPolling,
    checkPaymentStatusNow,
  };
}
