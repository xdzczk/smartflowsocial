import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { RelayStatus } from "~/features/auth/login-flow.client";
import { isMobile } from "~/lib/is-mobile";

import { Nip46QrUri } from "./Nip46QrUri";
import { PrimalLogoIcon } from "./PrimalLogoIcon";
import { RelayCheckStatus } from "./RelayCheckStatus";

export interface LoginAwaitingProfileSelectionProps {
  wasHiddenDuringConnection: boolean;
  timeRemaining: number | null;
  connectionTimeout: number | null;
  relayUrls: string[];
  relayStatuses: Record<string, RelayStatus>;
  nostrConnectUri: string | null;
  onCopyUri: () => void;
  copyOk: boolean;
  onLoginWithPrimal: () => void;
  onCancel: () => void;
}

export function LoginAwaitingProfileSelection({
  wasHiddenDuringConnection,
  timeRemaining,
  connectionTimeout,
  relayUrls,
  relayStatuses,
  nostrConnectUri,
  onCopyUri,
  copyOk,
  onLoginWithPrimal,
  onCancel,
}: LoginAwaitingProfileSelectionProps) {
  return (
    <div
      className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="text-primary h-5 w-5 animate-spin" aria-hidden />
        <div className="flex-1">
          <div className="text-foreground text-base font-bold">
            {wasHiddenDuringConnection
              ? "Returning from signer app…"
              : "Waiting for approval…"}
          </div>
          {timeRemaining !== null ? (
            <div className="text-muted-foreground mt-1 text-xs">
              Time remaining: {Math.ceil(timeRemaining / 1000)}s
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-muted-foreground text-sm leading-relaxed">
        {wasHiddenDuringConnection
          ? "Connection will resume automatically. Please wait…"
          : "Approve the connection in your remote signer. If you switch profiles, you switch identity and must re-authenticate."}
      </div>
      {timeRemaining !== null && connectionTimeout ? (
        <div className="space-y-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Connection progress</span>
            <span>
              {Math.round(
                ((connectionTimeout - timeRemaining) / connectionTimeout) * 100
              )}
              %
            </span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  ((connectionTimeout - timeRemaining) / connectionTimeout) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      {relayUrls.length > 0 ? (
        <RelayCheckStatus
          relayUrls={relayUrls}
          relayStatuses={relayStatuses}
          title="Relay status"
        >
          If any relays fail, remove them from the list and click Try again.
        </RelayCheckStatus>
      ) : null}
      {nostrConnectUri ? (
        <Nip46QrUri
          uri={nostrConnectUri}
          onCopy={() => onCopyUri()}
          copyOk={copyOk}
          textareaId="nip46NostrConnectUriWaiting"
          helperText="Scan or paste into your remote signer to approve."
        >
          {isMobile() ? (
            <Button
              type="button"
              variant="default"
              className="bg-background text-foreground hover:bg-muted border-border border"
              onClick={onLoginWithPrimal}
            >
              <span className="flex items-center gap-2">
                <PrimalLogoIcon className="size-5 shrink-0" />
                Login with Primal
              </span>
            </Button>
          ) : null}
        </Nip46QrUri>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => onCancel()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
