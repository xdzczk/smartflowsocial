"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import type { RelayStatus } from "~/features/auth/login-flow.client";
import { isMobile } from "~/lib/is-mobile";

import { useLoginAuthShell } from "./LoginAuthShellContext.client";
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
  const { setRightPanel, setAwaitingApproval } = useLoginAuthShell();

  useEffect(() => {
    setAwaitingApproval(true);
    setRightPanel(
      <Nip46QrUri
        variant="approval"
        uri={nostrConnectUri}
        onCopy={() => onCopyUri()}
        copyOk={copyOk}
        textareaId="nip46NostrConnectUriWaiting"
        helperText="Scan or paste this URI into your signer to approve."
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
    );
    return () => {
      setRightPanel(null);
      setAwaitingApproval(false);
    };
  }, [
    nostrConnectUri,
    copyOk,
    onCopyUri,
    onLoginWithPrimal,
    setRightPanel,
    setAwaitingApproval,
  ]);

  return (
    <div
      className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <Loader2
          className="text-primary mt-0.5 h-5 w-5 shrink-0 animate-spin"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-foreground text-base font-bold">
            {wasHiddenDuringConnection
              ? "Returning from signer app…"
              : "Waiting for approval"}
          </div>
          {timeRemaining !== null ? (
            <div className="text-muted-foreground text-xs">
              Time remaining: {Math.ceil(timeRemaining / 1000)}s
            </div>
          ) : null}
        </div>
      </div>

      <div className="text-muted-foreground space-y-1 text-sm leading-snug">
        {wasHiddenDuringConnection ? (
          <p>Connection will resume automatically. Please wait…</p>
        ) : (
          <>
            <p>Approve the connection in your remote signer.</p>
            <p>
              If you switch identities, you will need to authenticate again.
            </p>
          </>
        )}
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
          maxRows={5}
          className="border-border bg-muted/40 dark:bg-muted/20 space-y-1.5 rounded-md border p-2.5 pt-2 text-[11px] leading-tight"
        >
          If approval stalls, remove failed relays and try again.
        </RelayCheckStatus>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={() => onCancel()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
