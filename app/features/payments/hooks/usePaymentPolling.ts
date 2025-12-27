import { useNavigate } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
interface UsePaymentPollingProps {
  paymentId: string | null;
  onPaymentComplete: () => void;
}

/**
 * Custom hook for managing payment polling
 */
export function usePaymentPolling({
  paymentId: _paymentId,
  onPaymentComplete,
}: UsePaymentPollingProps) {
  const navigate = useNavigate();
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const shouldStopPolling = useRef(false);

  // Function to check payment status immediately
  const checkPaymentStatusNow = async (paymentId: string) => {
    try {
      const formData = new FormData();
      formData.append("paymentId", paymentId);

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
        data = JSON.parse(responseText) as { success?: boolean; paid?: boolean };
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
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 2000);
      }
    } catch (_error) {
      // Silently handle errors
    }
  };

  // Start automatic payment polling
  const startPaymentPolling = (paymentId: string) => {
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
        formData.append("paymentId", paymentId);

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
          data = JSON.parse(responseText) as { success?: boolean; paid?: boolean };
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

          // Redirect to dashboard after showing success message
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 2000);
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
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
          setIsPolling(false);
        }
      },
      5 * 60 * 1000,
    );
  };

  // Clean up polling on component unmount
  useEffect(() => {
    return () => {
      shouldStopPolling.current = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return {
    isPolling,
    startPaymentPolling,
    checkPaymentStatusNow,
  };
}




