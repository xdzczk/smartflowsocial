import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
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

interface UsePlansStateProps {
  user: { id: string; isEnabled: boolean } | null;
  actionData: any;
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

  const { isPolling, startPaymentPolling, checkPaymentStatusNow } =
    usePaymentPolling({
      paymentId: invoiceData?.paymentId || null,
      onPaymentComplete: () => {
        setPaymentComplete(true);
        setShowInvoice(false);
      },
    });

  // Handle action data (invoice creation or payment status)
  useEffect(() => {
    if (actionData?.success) {
      // Handle paid plan payment completion
      if (actionData.paid) {
        setPaymentComplete(true);
        setShowInvoice(false);
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 2000);
        return;
      }

      // Handle paid plan invoice creation
      if (actionData.invoice && actionData.invoice !== "free_plan") {
        setInvoiceData(actionData);
        setShowInvoice(true);
        // Set initial time remaining
        setTimeRemaining(new Date(actionData.expiresAt).getTime() - Date.now());
        // Start automatic payment status polling
        startPaymentPolling(actionData.paymentId);
      }
    }
  }, [actionData, navigate, startPaymentPolling]);

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
    planId: string,
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
    navigator.clipboard.writeText(text);
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

