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
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Complete Payment
          </h3>
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Selected Plan: {invoiceData.planName}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="dark:text-muted-foreground mb-2 flex justify-between text-sm text-gray-600">
            <span>Amount:</span>
            <span className="font-medium">${invoiceData.amountUsd} USD</span>
          </div>
          <div className="dark:text-muted-foreground mb-2 flex justify-between text-sm text-gray-600">
            <span>Lightning Amount:</span>
            <span className="font-medium">
              {invoiceData.amount.toLocaleString()} sats
            </span>
          </div>
          <div className="mb-4 flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Expires:</span>
            <span className="font-medium">
              {new Date(invoiceData.expiresAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="lightning-invoice"
            className="dark:text-foreground mb-2 block text-sm font-medium text-gray-700"
          >
            Lightning Invoice:
          </label>
          <div className="flex">
            <input
              id="lightning-invoice"
              type="text"
              value={invoiceData.invoice}
              readOnly
              className="dark:border-border dark:bg-card dark:text-foreground min-w-0 flex-1 rounded-l-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:placeholder-gray-400"
            />
            <button
              onClick={() => onCopy(invoiceData.invoice)}
              className="rounded-r-lg border border-l-0 border-gray-300 bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="mb-4 text-center">
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            Scan QR code or copy the invoice to your Lightning wallet
          </p>
          {/* QR Code */}
          <div className="mb-4 flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceData.invoice)}`}
              alt="Lightning Invoice QR Code"
              className="rounded border border-gray-300 dark:border-gray-600"
            />
          </div>
          {isPolling ? (
            <div className="flex items-center justify-center text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for payment...
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <p className="dark:text-muted-foreground mb-2 text-sm text-gray-500">
            This window will automatically close when payment is received
          </p>
          <div className="dark:text-muted-foreground text-xs text-gray-400">
            {timeRemaining > 0 ? (
              <>
                Payment expires in {Math.floor(timeRemaining / (1000 * 60))}:
                {String(
                  Math.floor((timeRemaining % (1000 * 60)) / 1000)
                ).padStart(2, "0")}
              </>
            ) : (
              <span className="text-red-500">Payment expired</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
