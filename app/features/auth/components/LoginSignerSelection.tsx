import { AlertTriangle, ExternalLink } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { isMobile } from "~/lib/is-mobile";

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
  return (
    <div className="min-h-[164px] space-y-4">
      <div className="text-foreground text-base font-semibold">
        Sign in with Nostr
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Button
            type="button"
            variant="default"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-auto w-full py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl"
            onClick={onNip07}
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
            <div className="text-muted-foreground space-y-1 text-xs">
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
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Alby
                  <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                </a>
                <a
                  href="https://github.com/fiatjaf/nos2x"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  nos2x
                  <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                </a>
                <a
                  href="https://amber.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Amber
                  <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                </a>
              </div>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-border bg-card hover:bg-muted hover:text-foreground h-auto py-3 text-base font-semibold shadow-md transition-all hover:shadow-lg dark:shadow-lg"
          onClick={onNip46}
        >
          Remote Signer
        </Button>
      </div>
      {isMobile() && onPrimal ? (
        <Button
          type="button"
          variant="default"
          className="bg-background text-foreground hover:bg-muted border-border h-auto w-full border py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl sm:col-span-2"
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
