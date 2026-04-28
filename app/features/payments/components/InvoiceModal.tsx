/**
 * Invoice modal for Lightning bolt11 or BTCPay checkout URL
 */

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [isCopied, setIsCopied] = useState(false);
  const [isOpeningWallet, setIsOpeningWallet] = useState(false);
  const [walletActionMessage, setWalletActionMessage] = useState("");
  const isBtcpay = checkoutKind === "btcpay";

  useEffect(() => {
    if (!isCopied) return;
    const timer = window.setTimeout(() => setIsCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [isCopied]);

  useEffect(() => {
    setIsCopied(false);
    setIsOpeningWallet(false);
    setWalletActionMessage("");
  }, [invoiceData.invoice, isOpen]);

  const handlePayInWallet = async () => {
    if (isBtcpay || isOpeningWallet) return;
    const invoice = invoiceData.invoice.trim();
    if (!invoice) return;

    setIsOpeningWallet(true);
    try {
      if (window.webln?.sendPayment) {
        try {
          await window.webln.enable?.();
          await window.webln.sendPayment(invoice);
          setWalletActionMessage(
            "Payment request sent to your Lightning wallet."
          );
          return;
        } catch {
          // Fall through to deep-link flow if WebLN isn't available or user cancels.
        }
      }

      const lightningUrl = `lightning:${invoice}`;
      const popup = window.open(lightningUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = lightningUrl;
      }
      setWalletActionMessage("Opening your wallet app...");
    } catch {
      onCopy(invoice);
      setIsCopied(true);
      setWalletActionMessage(
        "Couldn't open a wallet automatically. Invoice copied to clipboard."
      );
    } finally {
      setIsOpeningWallet(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-scrim/50 fixed inset-0 z-[60] flex items-center justify-center">
      <div className="bg-surface-overlay shadow-3 inset-card-lg mx-4 max-w-lg rounded-xl">
        <div className="mb-4">
          <h3 className="text-text mb-2 text-lg font-semibold">
            {isBtcpay ? "Pay with Bitcoin (on-chain)" : modalTitle}
          </h3>
          <div className="bg-surface-hover dark:bg-surface-hover/30 rounded-lg p-3">
            <p className="text-text text-sm font-medium">
              {invoiceData.contextLabel}
            </p>
          </div>
        </div>

        <div className="mb-4">
          {invoiceData.amountUsd != null ? (
            <div className="dark:text-text-secondary text-text mb-2 flex justify-between text-sm">
              <span>Amount:</span>
              <span className="font-medium">${invoiceData.amountUsd} USD</span>
            </div>
          ) : null}
          {!isBtcpay ? (
            <div className="dark:text-text-secondary text-text mb-2 flex justify-between text-sm">
              <span>Lightning amount:</span>
              <span className="font-medium">
                {invoiceData.amount.toLocaleString()} sats
              </span>
            </div>
          ) : (
            <div className="dark:text-text-secondary text-text mb-2 flex justify-between text-sm">
              <span>Estimated:</span>
              <span className="font-medium">
                ~{invoiceData.amount.toLocaleString()} sats (reference)
              </span>
            </div>
          )}
          <div className="text-text dark:text-text mb-4 flex justify-between text-sm">
            <span>{isBtcpay ? "Checkout valid until:" : "Expires:"}</span>
            <span className="font-medium">
              {new Date(invoiceData.expiresAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="payment-target"
            className="text-text-secondary mb-2 block text-sm font-medium"
          >
            {isBtcpay ? "BTCPay checkout link" : "Lightning invoice"}
          </label>
          <div className="flex">
            <input
              id="payment-target"
              type="text"
              value={invoiceData.invoice}
              readOnly
              className="focus-ring border-border bg-surface-hover text-text focus:border-brand min-w-0 flex-1 rounded-l-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                onCopy(invoiceData.invoice);
                setIsCopied(true);
              }}
              className="focus-ring-offset border-border bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 dark:border-border rounded-r-lg border border-l-0 px-3 py-2 text-sm"
            >
              {isCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <p
            className="text-text-secondary mt-2 text-xs"
            role="status"
            aria-live="polite"
          >
            {isCopied ? "Invoice copied to clipboard." : "\u00A0"}
          </p>
          {!isBtcpay ? (
            <button
              type="button"
              onClick={() => {
                void handlePayInWallet();
              }}
              disabled={isOpeningWallet}
              className="focus-ring-offset bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isOpeningWallet ? "Opening wallet..." : "Pay in wallet"}
            </button>
          ) : null}
          {!isBtcpay ? (
            <p
              className="text-text-secondary mt-2 text-xs"
              role="status"
              aria-live="polite"
            >
              {walletActionMessage || "\u00A0"}
            </p>
          ) : null}
        </div>

        {isBtcpay ? (
          <div className="mb-4">
            <a
              href={invoiceData.invoice}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring-offset bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 block w-full rounded-lg px-4 py-3 text-center text-sm font-medium"
            >
              Open BTCPay checkout
            </a>
            <p className="text-text-secondary mt-2 text-center text-xs">
              After paying on-chain, return here - we detect the first
              confirmation automatically (or use Check payment). Your plan
              activates only after one on-chain confirmation.
            </p>
          </div>
        ) : null}

        <div className="mb-4 text-center">
          <p className="text-text dark:text-text mb-2 text-sm">
            {isBtcpay
              ? "Scan the QR or open the checkout in your browser"
              : "Scan QR code or copy the invoice to your Lightning wallet"}
          </p>
          <div className="mb-4 flex justify-center">
            {!isBtcpay ? (
              <button
                type="button"
                onClick={() => {
                  void handlePayInWallet();
                }}
                disabled={isOpeningWallet}
                className="focus-ring-offset rounded-xs disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Open wallet from Lightning QR"
                title="Open wallet"
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceData.invoice)}`}
                  alt="Lightning invoice QR code"
                  className="border-border dark:border-border rounded-xs border"
                />
              </button>
            ) : (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceData.invoice)}`}
                alt="Checkout QR code"
                className="border-border dark:border-border rounded-xs border"
              />
            )}
          </div>
          {isPolling ? (
            <div className="text-text-secondary flex flex-col items-center justify-center gap-1 text-sm">
              <div className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isBtcpay && btcpayAwaitingConfirmations
                  ? "Payment received - waiting for 1st confirmation..."
                  : "Waiting for payment..."}
              </div>
              {isBtcpay && btcpayAwaitingConfirmations ? (
                <span className="text-text-secondary max-w-xs text-center text-xs">
                  You can close this window; a slim bar will stay at the top
                  until your transaction confirms.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <p className="dark:text-text-secondary text-text-secondary mb-2 text-sm">
            This window will automatically close when payment is received
          </p>
          <div className="dark:text-text-secondary text-text mb-4 text-xs">
            {timeRemaining > 0 ? (
              <>
                {isBtcpay ? "Checkout " : "Payment "}expires in{" "}
                {Math.floor(timeRemaining / (1000 * 60))}:
                {String(
                  Math.floor((timeRemaining % (1000 * 60)) / 1000)
                ).padStart(2, "0")}
              </>
            ) : (
              <span className="text-danger">Payment expired</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {invoiceData.paymentId && onCheckPayment ? (
              <button
                type="button"
                onClick={() => onCheckPayment(invoiceData.paymentId!)}
                className="focus-ring border-border bg-surface-hover text-text hover:bg-surface-active rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Check payment
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="focus-ring border-border bg-surface-hover text-text-secondary hover:bg-surface-hover/80 rounded-lg border px-4 py-2 text-sm font-medium"
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
