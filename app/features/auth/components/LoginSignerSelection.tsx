"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { isMobile } from "~/lib/is-mobile";
import { cn } from "~/lib/utils";

import { PrimalLogoIcon } from "./PrimalLogoIcon";

export interface LoginSignerSelectionProps {
  onNip07: () => void;
  onNip46: () => void;
  onPrimal?: () => void;
  /** false = extension not detected (show install links); null = still checking */
  nip07Available: boolean | null;
}

export function LoginSignerSelection({
  onNip07,
  onNip46,
  onPrimal,
  nip07Available,
}: LoginSignerSelectionProps) {
  const [highlighted, setHighlighted] = useState<"nip07" | "nip46" | null>(
    null
  );

  const implied = useMemo(
    () => (nip07Available === false ? "nip46" : "nip07"),
    [nip07Available]
  );
  const activeHint = highlighted ?? implied;

  const helperLine =
    activeHint === "nip07"
      ? "Best for Alby, nos2x, and other NIP-07 browser signers."
      : "Best for Amber, nsecBunker, and other NIP-46 remote signers.";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 min-h-[164px] space-y-4 duration-200">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Button
            type="button"
            variant="default"
            className={cn(
              "bg-brand text-brand-on hover:bg-brand/90 shadow-2 hover:shadow-3 h-auto w-full py-3 text-base font-semibold transition-all",
              highlighted === "nip07" &&
                "ring-brand/50 ring-offset-canvas ring-2 ring-offset-2"
            )}
            onClick={onNip07}
            onMouseEnter={() => setHighlighted("nip07")}
            onFocus={() => setHighlighted("nip07")}
            disabled={nip07Available === false}
          >
            <span className="flex items-center justify-center gap-2">
              Browser Extension
              {nip07Available === false ? (
                <AlertTriangle className={INLINE_ICON_SIZE_CLASS} />
              ) : null}
            </span>
          </Button>
          {nip07Available === false ? (
            <div className="text-text-secondary space-y-1 text-xs">
              <p className="flex items-center gap-1">
                <AlertTriangle className={SMALL_ICON_SIZE_CLASS} />
                Extension not detected
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span>Install:</span>
                <a
                  href="https://getalby.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand inline-flex items-center gap-1 hover:underline"
                >
                  Alby
                  <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                </a>
                <a
                  href="https://github.com/fiatjaf/nos2x"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand inline-flex items-center gap-1 hover:underline"
                >
                  nos2x
                  <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                </a>
                <a
                  href="https://amber.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand inline-flex items-center gap-1 hover:underline"
                >
                  Amber
                  <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                </a>
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "border-border bg-surface hover:bg-surface-hover hover:text-text shadow-2 hover:shadow-2 dark:shadow-2 h-auto w-full py-3 text-base font-semibold transition-all",
              highlighted === "nip46" &&
                "ring-brand/40 ring-offset-canvas ring-2 ring-offset-2"
            )}
            onClick={onNip46}
            onMouseEnter={() => setHighlighted("nip46")}
            onFocus={() => setHighlighted("nip46")}
          >
            Remote Signer
          </Button>
        </div>
      </div>

      <p className="text-text-secondary min-h-[2.5rem] text-center text-xs leading-relaxed sm:text-left">
        {helperLine}
      </p>

      <div className="text-text-secondary/90 border-border/60 space-y-0.5 border-t pt-3 text-center text-[11px] leading-relaxed sm:text-left">
        <p>No private key upload</p>
        <p>Signer-based authentication only</p>
      </div>

      {isMobile() && onPrimal ? (
        <Button
          type="button"
          variant="default"
          className="bg-canvas text-text hover:bg-surface-hover border-border shadow-2 hover:shadow-3 h-auto w-full border py-3 text-base font-semibold transition-all sm:col-span-2"
          onClick={onPrimal}
        >
          <span className="flex items-center justify-center gap-2">
            <PrimalLogoIcon className="size-5 shrink-0" />
            Login with Primal
          </span>
        </Button>
      ) : null}
    </div>
  );
}
