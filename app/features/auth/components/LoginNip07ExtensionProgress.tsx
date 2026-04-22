import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import type { Nip07LoginStatus } from "~/features/auth/nip07-login.client";

import {
  AuthActionRow,
  AuthInlineTipList,
  AuthProgressHeader,
  AuthStepList,
  type AuthStepItem,
} from "./auth-ui";
import { useLoginAuthShell } from "./LoginAuthShellContext";

export interface LoginNip07ExtensionProgressProps {
  nip07Status: Nip07LoginStatus;
  nip07Available: boolean | null;
  onTryAgain: () => void;
  onUseRemoteSigner: () => void;
}

function useElapsedMs(): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setElapsedMs(Math.floor(performance.now() - t0));
    }, 250);
    return () => clearInterval(id);
  }, []);

  return elapsedMs;
}

export function LoginNip07ExtensionProgress({
  nip07Status,
  nip07Available,
  onTryAgain,
  onUseRemoteSigner,
}: LoginNip07ExtensionProgressProps) {
  const { setRightPanel } = useLoginAuthShell();
  const isBusy = nip07Status === "loading";
  const elapsedMs = useElapsedMs();
  const tier = elapsedMs < 2000 ? 0 : elapsedMs < 5000 ? 1 : 2;

  useEffect(() => {
    const showAssist =
      isBusy && nip07Available !== false && tier >= 1 && tier < 2;
    const showStrongAssist = isBusy && nip07Available !== false && tier >= 2;

    if (showStrongAssist) {
      setRightPanel(
        <div className="text-center sm:text-left">
          <p className="text-text mb-2 text-sm font-semibold">
            Still no prompt?
          </p>
          <ul className="text-text-secondary list-disc space-y-1.5 pl-4 text-left text-xs leading-relaxed">
            <li>Unlock your extension and check the toolbar icon.</li>
            <li>Pop-ups may be blocked — allow them for this site.</li>
            <li>Try another browser profile if you use multiple.</li>
          </ul>
        </div>
      );
      return () => setRightPanel(null);
    }

    if (showAssist) {
      setRightPanel(
        <div className="text-center sm:text-left">
          <p className="text-text text-sm font-semibold">
            Check your extension
          </p>
          <p className="text-text-secondary mt-2 text-sm leading-relaxed">
            A signing prompt may be open behind this window or in the extension
            menu. Look for your Nostr signer in the browser toolbar.
          </p>
        </div>
      );
      return () => setRightPanel(null);
    }

    setRightPanel(null);
    return () => setRightPanel(null);
  }, [isBusy, nip07Available, setRightPanel, tier]);

  const { headline, subcopy } = useMemo(() => {
    if (tier === 0) {
      return {
        headline: "Requesting signature from your browser extension",
        subcopy: "A prompt should appear in your Nostr extension.",
      };
    }
    if (tier === 1) {
      return {
        headline: "Waiting for approval",
        subcopy:
          "Open your extension and approve the request. This can take a few seconds.",
      };
    }
    return {
      headline: "Still waiting",
      subcopy:
        "Open your extension and approve the request. If nothing appears, use the tips below.",
    };
  }, [tier]);

  const extensionTips =
    tier >= 2
      ? [
          "Make sure your extension is installed and unlocked.",
          "Check for a hidden approval popup or banner.",
          "Confirm you are using the correct browser profile.",
        ]
      : [];

  const steps: AuthStepItem[] = useMemo(() => {
    const step1: AuthStepItem = {
      id: "detect",
      label: "Detecting extension",
      status:
        nip07Available === false
          ? "failed"
          : nip07Available === true
            ? "complete"
            : isBusy
              ? "active"
              : "pending",
    };

    const step2: AuthStepItem = {
      id: "approve",
      label: "Requesting approval",
      status:
        nip07Available === false
          ? "failed"
          : isBusy && nip07Available === true
            ? "active"
            : "pending",
    };

    const step3: AuthStepItem = {
      id: "signin",
      label: "Signing you in",
      status: "pending",
    };

    return [step1, step2, step3];
  }, [nip07Available, isBusy]);

  const showEscalationActions = tier >= 1 && isBusy && nip07Available !== false;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 min-h-[220px] space-y-4 duration-200"
      role="status"
      aria-live="polite"
      aria-busy={isBusy}
    >
      <div className="flex items-start gap-3">
        <Loader2
          className="text-brand mt-0.5 h-5 w-5 shrink-0 animate-spin"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-3">
          <AuthProgressHeader headline={headline} subcopy={subcopy} />
        </div>
      </div>

      <AuthStepList steps={steps} />

      {extensionTips.length > 0 ? (
        <AuthInlineTipList intro="If it still hangs:" items={extensionTips} />
      ) : null}

      {nip07Available === false ? (
        <p className="text-text-secondary text-sm">
          No NIP-07 extension was detected. Install a signer or use remote
          signer instead.
        </p>
      ) : null}

      {showEscalationActions ? (
        <AuthActionRow>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border"
            onClick={() => onTryAgain()}
          >
            Try again
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-text-secondary hover:text-text"
            onClick={() => onUseRemoteSigner()}
          >
            Use remote signer instead
          </Button>
        </AuthActionRow>
      ) : null}

      {nip07Available === false ? (
        <AuthActionRow>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="shadow-2"
            onClick={() => onUseRemoteSigner()}
          >
            Use remote signer
          </Button>
        </AuthActionRow>
      ) : null}
    </div>
  );
}
