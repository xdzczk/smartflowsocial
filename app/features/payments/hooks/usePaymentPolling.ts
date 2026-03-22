import { useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
const PAYMENT_ID_FIELD = "paymentId";

interface UsePaymentPollingProps {
  paymentId: string | null;
  onPaymentComplete: () => void;
  /** When true, do not redirect after a successful payment (e.g. giveaway finalization). */
  skipSuccessNavigation?: boolean;
}

/**
 * Custom hook for managing payment polling
 */
export function usePaymentPolling({
  paymentId: _paymentId,
  onPaymentComplete,
  skipSuccessNavigation = false,
}: UsePaymentPollingProps) {
  const navigate = useNavigate();
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const shouldStopPolling = useRef(false);

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
      let data: { success?: boolean; paid?: boolean };
      try {
        data = JSON.parse(responseText) as {
          success?: boolean;
          paid?: boolean;
        };
      } catch (_parseError) {
        return;
      }

      if (data.success && data.paid) {
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
            let data: { success?: boolean; paid?: boolean };
            try {
              data = JSON.parse(responseText) as {
                success?: boolean;
                paid?: boolean;
              };
            } catch (_parseError) {
              return;
            }

            if (data.success && data.paid) {
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
      }, 5000); // Poll every 5 seconds

      setPollingInterval(interval);

      // Stop polling after 5 minutes
      setTimeout(
        () => {
          shouldStopPolling.current = true;
          clearInterval(interval);
          setPollingInterval(null);
          setIsPolling(false);
        },
        5 * 60 * 1000
      );
    },
    [
      isPolling,
      pollingInterval,
      onPaymentComplete,
      navigate,
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

  return {
    isPolling,
    startPaymentPolling,
    checkPaymentStatusNow,
  };
}
