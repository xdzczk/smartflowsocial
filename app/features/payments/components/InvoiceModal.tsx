/**
 * Invoice modal component for payment
 */

import { Loader2 } from "lucide-react";
interface InvoiceModalProps {
  isOpen: boolean;
  invoiceData: {
    invoice: string;
    amount: number;
    amountUsd: number;
    expiresAt: string;
    planName: string;
  };
  timeRemaining: number;
  isPolling: boolean;
  onCopy: (text: string) => void;
}

export function InvoiceModal({
  isOpen,
  invoiceData,
  timeRemaining,
  isPolling,
  onCopy,
}: InvoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="dark:bg-card mx-4 max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-foreground mb-2 text-lg font-semibold dark:text-white">
            Complete Payment
          </h3>
          <div className="bg-muted dark:bg-muted/30 rounded-lg p-3">
            <p className="text-foreground dark:text-foreground text-sm font-medium">
              Selected Plan: {invoiceData.planName}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="dark:text-muted-foreground text-foreground mb-2 flex justify-between text-sm">
            <span>Amount:</span>
            <span className="font-medium">${invoiceData.amountUsd} USD</span>
          </div>
          <div className="dark:text-muted-foreground text-foreground mb-2 flex justify-between text-sm">
            <span>Lightning Amount:</span>
            <span className="font-medium">
              {invoiceData.amount.toLocaleString()} sats
            </span>
          </div>
          <div className="text-foreground dark:text-foreground mb-4 flex justify-between text-sm">
            <span>Expires:</span>
            <span className="font-medium">
              {new Date(invoiceData.expiresAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="lightning-invoice"
            className="dark:text-foreground text-muted-foreground mb-2 block text-sm font-medium"
          >
            Lightning Invoice:
          </label>
          <div className="flex">
            <input
              id="lightning-invoice"
              type="text"
              value={invoiceData.invoice}
              readOnly
              className="dark:border-border dark:bg-card dark:text-foreground border-border bg-muted text-foreground dark:placeholder-muted-foreground focus:border-primary focus:ring-primary min-w-0 flex-1 rounded-l-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
            <button
              onClick={() => onCopy(invoiceData.invoice)}
              className="border-border dark:border-border bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary rounded-r-lg border border-l-0 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="mb-4 text-center">
          <p className="text-foreground dark:text-foreground mb-2 text-sm">
            Scan QR code or copy the invoice to your Lightning wallet
          </p>
          {/* QR Code */}
          <div className="mb-4 flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceData.invoice)}`}
              alt="Lightning Invoice QR Code"
              className="border-border dark:border-border rounded border"
            />
          </div>
          {isPolling ? (
            <div className="text-muted-foreground flex items-center justify-center text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for payment...
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <p className="dark:text-muted-foreground text-muted-foreground mb-2 text-sm">
            This window will automatically close when payment is received
          </p>
          <div className="dark:text-muted-foreground text-foreground text-xs">
            {timeRemaining > 0 ? (
              <>
                Payment expires in {Math.floor(timeRemaining / (1000 * 60))}:
                {String(
                  Math.floor((timeRemaining % (1000 * 60)) / 1000)
                ).padStart(2, "0")}
              </>
            ) : (
              <span className="text-destructive">Payment expired</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
