import { useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePaymentPolling } from "./usePaymentPolling";
interface InvoiceData {
  invoice: string;
  paymentHash: string;
  amount: number;
  amountUsd: number;
  paymentId: string;
  expiresAt: string;
  planName: string;
  planId: string;
}

interface ActionData {
  success?: boolean;
  paid?: boolean;
  invoice?: string;
  paymentHash?: string;
  amount?: number;
  amountUsd?: number;
  paymentId?: string;
  expiresAt?: string;
  planName?: string;
  planId?: string;
  error?: string;
}

interface UsePlansStateProps {
  user: { id: string; isEnabled: boolean } | null;
  actionData: ActionData | null;
}

/**
 * Custom hook for managing plans page state and operations
 */
export function usePlansState({ user, actionData }: UsePlansStateProps) {
  const navigate = useNavigate();
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const processedPaymentIdRef = useRef<string | null>(null);

  const handlePaymentComplete = useCallback(() => {
    setPaymentComplete(true);
    setShowInvoice(false);
  }, []);

  const { isPolling, startPaymentPolling } = usePaymentPolling({
    paymentId: invoiceData?.paymentId ?? null,
    onPaymentComplete: handlePaymentComplete,
  });

  // Store startPaymentPolling in a ref to avoid dependency issues
  const startPaymentPollingRef = useRef(startPaymentPolling);
  useEffect(() => {
    startPaymentPollingRef.current = startPaymentPolling;
  }, [startPaymentPolling]);

  // Handle action data (invoice creation or payment status)
  useEffect(() => {
    if (actionData?.success) {
      // Handle paid plan payment completion
      if (actionData.paid) {
        // Defer to avoid cascading renders
        setTimeout(() => {
          setPaymentComplete(true);
          setShowInvoice(false);
        }, 0);
        processedPaymentIdRef.current = null;
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 2000);
        return;
      }

      // Handle paid plan invoice creation
      if (actionData.invoice && actionData.invoice !== "free_plan") {
        // Convert ActionData to InvoiceData (all required fields must be present)
        if (
          actionData.paymentHash &&
          actionData.amount !== undefined &&
          actionData.amountUsd !== undefined &&
          actionData.paymentId &&
          actionData.expiresAt &&
          actionData.planName &&
          actionData.planId
        ) {
          // Only process if we haven't already processed this paymentId
          if (processedPaymentIdRef.current === actionData.paymentId) {
            return;
          }

          processedPaymentIdRef.current = actionData.paymentId;

          const expiresAt = actionData.expiresAt;
          const invoice: InvoiceData = {
            invoice: actionData.invoice,
            paymentHash: actionData.paymentHash,
            amount: actionData.amount,
            amountUsd: actionData.amountUsd,
            paymentId: actionData.paymentId,
            expiresAt: expiresAt,
            planName: actionData.planName,
            planId: actionData.planId,
          };
          // Defer to avoid cascading renders
          setTimeout(() => {
            setInvoiceData(invoice);
            setShowInvoice(true);
            // Set initial time remaining
            if (expiresAt) {
              setTimeRemaining(new Date(expiresAt).getTime() - Date.now());
            }
          }, 0);
        }
      }
    }
  }, [actionData, navigate]);

  // Start polling when invoiceData is set (only once per paymentId)
  const lastPolledPaymentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      invoiceData?.paymentId &&
      invoiceData.paymentId === processedPaymentIdRef.current &&
      lastPolledPaymentIdRef.current !== invoiceData.paymentId
    ) {
      lastPolledPaymentIdRef.current = invoiceData.paymentId;
      startPaymentPollingRef.current(invoiceData.paymentId);
    }
  }, [invoiceData?.paymentId]);

  // Countdown timer effect
  useEffect(() => {
    if (showInvoice && invoiceData) {
      const timer = setInterval(() => {
        const remaining =
          new Date(invoiceData.expiresAt).getTime() - Date.now();
        setTimeRemaining(Math.max(0, remaining));

        if (remaining <= 0) {
          clearInterval(timer);
          setShowInvoice(false);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [showInvoice, invoiceData]);

  // Function to handle plan selection
  const handlePlanSelection = (
    event: React.MouseEvent<HTMLButtonElement>,
    planId: string
  ) => {
    if (!user) {
      // Prevent form submission and redirect to login if not authenticated
      event.preventDefault();
      navigate("/login", { replace: true });
      return false;
    }
    setSelectedPlan(planId);
    return true;
  };

  // Function to copy invoice to clipboard
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return {
    showInvoice,
    invoiceData,
    paymentComplete,
    selectedPlan,
    timeRemaining,
    isPolling,
    setSelectedPlan,
    handlePlanSelection,
    copyToClipboard,
  };
}
