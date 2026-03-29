/**
 * Invoice modal for Lightning bolt11 or BTCPay checkout URL
 */

import { Loader2 } from "lucide-react";

import type { InvoiceCheckoutKind } from "~/features/payments/types";

interface InvoiceModalProps {
  isOpen: boolean;
  invoiceData: {
    invoice: string;
    amount: number;
    /** Null hides the fiat line (e.g. sats-only finalization fee). */
    amountUsd: number | null;
    expiresAt: string;
    /** Shown in the summary box (plan picker or giveaway context). */
    contextLabel: string;
    paymentId?: string;
  };
  checkoutKind?: InvoiceCheckoutKind;
  /** Modal title; default Complete payment */
  modalTitle?: string;
  timeRemaining: number;
  isPolling: boolean;
  /** BTCPay: payment seen on-chain but fewer than required confirmations yet. */
  btcpayAwaitingConfirmations?: boolean;
  onCopy: (text: string) => void;
  onCheckPayment?: (paymentId: string) => void;
  onClose?: () => void;
}

export function InvoiceModal({
  isOpen,
  invoiceData,
  checkoutKind = "lightning",
  modalTitle = "Complete payment",
  timeRemaining,
  isPolling,
  btcpayAwaitingConfirmations = false,
  onCopy,
  onCheckPayment,
  onClose,
}: InvoiceModalProps) {
  if (!isOpen) return null;

  const isBtcpay = checkoutKind === "btcpay";

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="dark:bg-card mx-4 max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-foreground mb-2 text-lg font-semibold dark:text-white">
            {isBtcpay ? "Pay with Bitcoin (on-chain)" : modalTitle}
          </h3>
          <div className="bg-muted dark:bg-muted/30 rounded-lg p-3">
            <p className="text-foreground dark:text-foreground text-sm font-medium">
              {invoiceData.contextLabel}
            </p>
          </div>
        </div>

        <div className="mb-4">
          {invoiceData.amountUsd != null ? (
            <div className="dark:text-muted-foreground text-foreground mb-2 flex justify-between text-sm">
              <span>Amount:</span>
              <span className="font-medium">${invoiceData.amountUsd} USD</span>
            </div>
          ) : null}
          {!isBtcpay ? (
            <div className="dark:text-muted-foreground text-foreground mb-2 flex justify-between text-sm">
              <span>Lightning amount:</span>
              <span className="font-medium">
                {invoiceData.amount.toLocaleString()} sats
              </span>
            </div>
          ) : (
            <div className="dark:text-muted-foreground text-foreground mb-2 flex justify-between text-sm">
              <span>Estimated:</span>
              <span className="font-medium">
                ~{invoiceData.amount.toLocaleString()} sats (reference)
              </span>
            </div>
          )}
          <div className="text-foreground dark:text-foreground mb-4 flex justify-between text-sm">
            <span>{isBtcpay ? "Checkout valid until:" : "Expires:"}</span>
            <span className="font-medium">
              {new Date(invoiceData.expiresAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="payment-target"
            className="dark:text-foreground text-muted-foreground mb-2 block text-sm font-medium"
          >
            {isBtcpay ? "BTCPay checkout link" : "Lightning invoice"}
          </label>
          <div className="flex">
            <input
              id="payment-target"
              type="text"
              value={invoiceData.invoice}
              readOnly
              className="dark:border-border dark:bg-card dark:text-foreground border-border bg-muted text-foreground dark:placeholder-muted-foreground focus:border-primary focus:ring-ring min-w-0 flex-1 rounded-l-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onCopy(invoiceData.invoice)}
              className="border-border dark:border-border bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring rounded-r-lg border border-l-0 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            >
              Copy
            </button>
          </div>
        </div>

        {isBtcpay ? (
          <div className="mb-4">
            <a
              href={invoiceData.invoice}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring block w-full rounded-lg px-4 py-3 text-center text-sm font-medium focus:ring-1 focus:outline-none"
            >
              Open BTCPay checkout
            </a>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              After paying on-chain, return here — we detect the first
              confirmation automatically (or use Check payment). Your plan
              activates only after one on-chain confirmation.
            </p>
          </div>
        ) : null}

        <div className="mb-4 text-center">
          <p className="text-foreground dark:text-foreground mb-2 text-sm">
            {isBtcpay
              ? "Scan the QR or open the checkout in your browser"
              : "Scan QR code or copy the invoice to your Lightning wallet"}
          </p>
          <div className="mb-4 flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceData.invoice)}`}
              alt={isBtcpay ? "Checkout QR code" : "Lightning invoice QR code"}
              className="border-border dark:border-border rounded border"
            />
          </div>
          {isPolling ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-1 text-sm">
              <div className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isBtcpay && btcpayAwaitingConfirmations
                  ? "Payment received — waiting for 1st confirmation..."
                  : "Waiting for payment..."}
              </div>
              {isBtcpay && btcpayAwaitingConfirmations ? (
                <span className="text-muted-foreground max-w-xs text-center text-xs">
                  You can close this window; a slim bar will stay at the top
                  until your transaction confirms.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <p className="dark:text-muted-foreground text-muted-foreground mb-2 text-sm">
            This window will automatically close when payment is received
          </p>
          <div className="dark:text-muted-foreground text-foreground mb-4 text-xs">
            {timeRemaining > 0 ? (
              <>
                {isBtcpay ? "Checkout " : "Payment "}expires in{" "}
                {Math.floor(timeRemaining / (1000 * 60))}:
                {String(
                  Math.floor((timeRemaining % (1000 * 60)) / 1000)
                ).padStart(2, "0")}
              </>
            ) : (
              <span className="text-destructive">Payment expired</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {invoiceData.paymentId && onCheckPayment ? (
              <button
                type="button"
                onClick={() => onCheckPayment(invoiceData.paymentId!)}
                className="border-border bg-secondary text-secondary-foreground hover:bg-secondary/90 focus:ring-ring rounded-lg border px-4 py-2 text-sm font-medium focus:ring-1 focus:outline-none"
              >
                Check payment
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="border-border bg-muted text-muted-foreground hover:bg-muted/80 focus:ring-ring rounded-lg border px-4 py-2 text-sm font-medium focus:ring-1 focus:outline-none"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
