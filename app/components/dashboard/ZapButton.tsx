import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
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
}

export default function ZapButton({
  npub,
  amountSats,
  size = "default",
  onZapped,
}: ZapButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await zapRecipient({ npub, amountSats });
      if (result.paid) {
        onZapped?.();
        toast.success("Zap sent");
      } else {
        toast.success("Opened in new tab — mark as zapped when done");
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

  return (
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
  );
}
