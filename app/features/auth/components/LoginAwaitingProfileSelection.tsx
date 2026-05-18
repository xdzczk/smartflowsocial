"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "~/components/ui/button";
import type { RelayStatus } from "~/features/auth/login-flow.client";
import { isAndroid, isMobile } from "~/lib/is-mobile";

import { AmberLoginIcon } from "./AmberLoginIcon";
import { AuthProgressHeader, AuthStepList, type AuthStepItem } from "./auth-ui";
import { useLoginAuthShell } from "./LoginAuthShellContext";
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
  onLoginWithAmber: () => void;
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
  onLoginWithAmber,
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
        helperText="Use your remote signer to scan or paste the URI below."
        approvalHeading="Scan to approve"
        approvalSubtext="Use your remote signer to scan or paste the URI below."
      >
        {isMobile() && isAndroid() ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              className="bg-canvas text-text hover:bg-surface-hover border-border border"
              onClick={onLoginWithAmber}
            >
              <span className="cluster">
                <AmberLoginIcon className="size-5 shrink-0" />
                Login with Amber
              </span>
            </Button>
            <Button
              type="button"
              variant="default"
              className="bg-canvas text-text hover:bg-surface-hover border-border border"
              onClick={onLoginWithPrimal}
            >
              <span className="cluster">
                <PrimalLogoIcon className="size-5 shrink-0" />
                Login with Primal
              </span>
            </Button>
          </div>
        ) : isMobile() ? (
          <Button
            type="button"
            variant="default"
            className="bg-canvas text-text hover:bg-surface-hover border-border border"
            onClick={onLoginWithPrimal}
          >
            <span className="cluster">
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
    onLoginWithAmber,
    setRightPanel,
    setAwaitingApproval,
  ]);

  const steps: AuthStepItem[] = useMemo(
    () => [
      {
        id: "relays",
        label: "Relays reachable",
        status: "complete",
      },
      {
        id: "wait",
        label: "Waiting for approval",
        status: "active",
        description: wasHiddenDuringConnection
          ? "Resuming after you left this tab…"
          : "Approve the connection in your remote signer.",
      },
      {
        id: "session",
        label: "Opening your session",
        status: "pending",
      },
    ],
    [wasHiddenDuringConnection]
  );

  const { headline, subcopy } = useMemo(() => {
    if (wasHiddenDuringConnection) {
      return {
        headline: "Returning from your signer",
        subcopy: "Connection will resume automatically. Please wait…",
      };
    }
    return {
      headline: "Waiting for approval",
      subcopy:
        "Approve the connection in your remote signer. If you switch identities, you may need to authenticate again.",
    };
  }, [wasHiddenDuringConnection]);

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 space-y-5 duration-200"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <Loader2
          className="text-link mt-0.5 h-5 w-5 shrink-0 animate-spin"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-3">
          <AuthProgressHeader headline={headline} subcopy={subcopy} />
        </div>
      </div>

      <AuthStepList steps={steps} />

      {timeRemaining !== null ? (
        <div className="text-text-secondary text-xs">
          Time remaining: {Math.ceil(timeRemaining / 1000)}s
        </div>
      ) : null}

      {timeRemaining !== null && connectionTimeout ? (
        <div className="space-y-1">
          <div className="text-text-secondary flex justify-between text-xs">
            <span>Progress</span>
            <span>
              {Math.round(
                ((connectionTimeout - timeRemaining) / connectionTimeout) * 100
              )}
              %
            </span>
          </div>
          <div className="bg-surface-hover h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-action-primary h-full transition-all duration-300"
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
          title="Relay connectivity"
          maxRows={5}
        >
          If approval stalls, remove failed relays and try again.
        </RelayCheckStatus>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" onClick={() => onCancel()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
