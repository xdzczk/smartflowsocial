import { Link } from "@remix-run/react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import {
  zapRecipient,
  ZAP_FLOW_ERROR_NO_LUD16,
  ZAP_FLOW_ERROR_NO_WEBLN,
} from "~/lib/zap-flow.client";

import { useLookupSheetWide } from "./useLookupSheetWide";

const PRESETS = [21, 100, 500, 1000] as const;

export interface ZapNoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorNpub: string;
  /** Hex event id for note-scoped zap request. */
  eventIdHex: string;
  publishRelays: string[];
}

export function ZapNoteDrawer({
  open,
  onOpenChange,
  authorNpub,
  eventIdHex,
  publishRelays,
}: ZapNoteDrawerProps) {
  const wide = useLookupSheetWide();
  const [amountSats, setAmountSats] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null);
    }
    onOpenChange(next);
  };

  const resolvedAmount = () => {
    const c = custom.trim();
    if (c) {
      const n = Number(c);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : amountSats;
    }
    return amountSats;
  };

  const send = async () => {
    setError(null);
    setLoading(true);
    try {
      const amt = resolvedAmount();
      const result = await zapRecipient({
        npub: authorNpub,
        amountSats: amt,
        relays: publishRelays.length > 0 ? publishRelays : undefined,
        eventIdHex,
      });
      if (result.paid) {
        toast.success(`Zap sent (${amt} sats)`);
        handleOpenChange(false);
      } else {
        toast.success("Opened payment in a new tab — complete there if needed");
        handleOpenChange(false);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Zap failed";
      if (message === ZAP_FLOW_ERROR_NO_LUD16) {
        setError("Author has no Lightning address on profile.");
      } else if (message === ZAP_FLOW_ERROR_NO_WEBLN) {
        setError(
          "Zap requires a connected wallet with WebLN. Install a Lightning wallet or complete payment externally."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={cn(
          wide
            ? "w-full max-w-md gap-0 p-0 sm:max-w-md"
            : "max-h-[85vh] gap-0 rounded-t-xl p-0"
        )}
      >
        <SheetHeader className="border-border space-y-1 border-b px-4 py-3 text-left">
          <SheetTitle className="text-base">Zap</SheetTitle>
          <SheetDescription className="text-left text-sm">
            Send sats to the note author. Amount presets below.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={
                  amountSats === n && !custom.trim() ? "default" : "outline"
                }
                className="h-9 text-xs"
                onClick={() => {
                  setCustom("");
                  setAmountSats(n);
                  setError(null);
                }}
              >
                {n}
              </Button>
            ))}
          </div>
          <div>
            <label
              htmlFor="lookup-zap-custom"
              className="text-muted-foreground mb-1 block text-xs"
            >
              Custom (sats)
            </label>
            <Input
              id="lookup-zap-custom"
              inputMode="numeric"
              placeholder="Optional"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setError(null);
              }}
              className="h-9"
            />
          </div>
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-muted-foreground text-[11px] leading-snug">
            Uses WebLN when available. Configure wallet under{" "}
            <Link
              to="/dashboard/settings"
              className="text-primary underline-offset-2 hover:underline"
            >
              Settings
            </Link>
            .
          </p>
        </div>
        <SheetFooter className="border-border flex-row justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="border-amber-500/40 bg-amber-500/10 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100"
            disabled={loading}
            onClick={() => void send()}
          >
            {loading ? "Working…" : `Send ${resolvedAmount()} sats`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
