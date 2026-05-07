import { useState } from "react";
import { toast } from "react-hot-toast";
import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  zapRecipient,
  ZAP_FLOW_ERROR_NO_LUD16,
  ZAP_FLOW_ERROR_NO_WEBLN,
} from "~/lib/zap-flow.client";

interface ZapButtonProps {
  npub: string;
  /** Optional sats amount to suggest (shown in label). */
  amountSats?: number;
  /** Button size; defaults to default. Use "sm" in dense lists. */
  size?: "default" | "sm" | "lg" | "icon";
  /** Called when zap payment completes successfully (e.g. to auto-mark winner as zapped). */
  onZapped?: () => void;
  /** Called when a valid invoice is generated but payment is pending/manual. */
  onInvoiceCreated?: (invoice: string) => void;
}

export default function ZapButton({
  npub,
  amountSats,
  size = "default",
  onZapped,
  onInvoiceCreated,
}: ZapButtonProps) {
  const [loading, setLoading] = useState(false);
  const [fallbackInvoice, setFallbackInvoice] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await zapRecipient({
        npub,
        amountSats,
        returnInvoiceOnNoWallet: true,
      });
      if (result.paid) {
        onZapped?.();
        toast.success("Zap sent");
      } else if (result.invoice) {
        onInvoiceCreated?.(result.invoice);
        setFallbackInvoice(result.invoice);
        toast.success(
          result.weblnTimedOut
            ? "Wallet payment timed out — pay with QR or copy below."
            : "Invoice generated. Pay to complete payout."
        );
      } else {
        toast.success("Opened in new tab  -  mark as zapped when done");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zap failed";
      if (message === ZAP_FLOW_ERROR_NO_LUD16) {
        toast.error("Recipient has no Lightning address");
      } else if (message === ZAP_FLOW_ERROR_NO_WEBLN) {
        toast.error(
          "Connect NWC in billing settings, or use a browser wallet with WebLN to zap"
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const label =
    amountSats != null && amountSats > 0 ? `Zap ${amountSats} sats` : "Zap";
  const lightningUri = fallbackInvoice
    ? `lightning:${fallbackInvoice}`
    : undefined;

  return (
    <>
      <Button
        type="button"
        variant="default"
        size={size}
        className="gap-1.5"
        disabled={loading}
        onClick={() => void handleClick()}
      >
        {loading ? (
          <span className="text-text-secondary">Opening wallet…</span>
        ) : (
          <>
            <span aria-hidden>⚡</span>
            {label}
          </>
        )}
      </Button>
      <Dialog
        open={fallbackInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setFallbackInvoice(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Lightning invoice</DialogTitle>
            <DialogDescription>
              Manual payout fallback: pay this invoice, then mark winner as paid
              once payment is confirmed.
            </DialogDescription>
          </DialogHeader>
          {fallbackInvoice ? (
            <div className="space-y-3">
              <div className="bg-surface-hover mx-auto w-fit rounded-md p-3">
                <QRCode value={fallbackInvoice} size={192} />
              </div>
              <textarea
                readOnly
                value={fallbackInvoice}
                rows={4}
                className="bg-surface-hover text-text w-full rounded-md px-3 py-2 text-xs"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!fallbackInvoice) return;
                void (async () => {
                  await navigator.clipboard.writeText(fallbackInvoice);
                  toast.success("Invoice copied");
                })();
              }}
            >
              Copy invoice
            </Button>
            <Button
              type="button"
              disabled={!lightningUri}
              onClick={() => {
                if (!lightningUri) return;
                window.open(lightningUri, "_blank", "noopener,noreferrer");
              }}
            >
              Open wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
