import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { formatNpubShort } from "~/features/auth/login-flow.client";

import {
  AuthInlineTipList,
  AuthProgressHeader,
  AuthStepList,
  type AuthStepItem,
} from "./auth-ui";

export interface LoginRequestingSignatureProps {
  signingInDisplayName: string | null;
  pubkey: string;
  isVerifying: boolean;
  onCancel: () => void;
  signerFlow: "nip07" | "nip46";
}

function useElapsedMsFromMount(): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setElapsedMs(Math.floor(performance.now() - t0));
    }, 400);
    return () => clearInterval(id);
  }, []);
  return elapsedMs;
}

export function LoginRequestingSignature({
  signingInDisplayName,
  pubkey,
  isVerifying,
  onCancel,
  signerFlow,
}: LoginRequestingSignatureProps) {
  const elapsedMs = useElapsedMsFromMount();
  const showSlowSignHelp =
    signerFlow === "nip07" && !isVerifying && elapsedMs >= 3000;

  const { headline, subcopy } = useMemo(() => {
    if (isVerifying) {
      return {
        headline: "Verifying your sign-in",
        subcopy: "Hang tight — we're confirming your signature on our servers.",
      };
    }
    if (signerFlow === "nip46") {
      return {
        headline: "Confirm in your remote signer",
        subcopy:
          "Approve the login signature in your remote signer. This step secures your session.",
      };
    }
    if (showSlowSignHelp) {
      return {
        headline: "Still waiting for a signature",
        subcopy:
          "Your extension should show a signing prompt. Check the toolbar if you don't see it.",
      };
    }
    return {
      headline: "Confirm in your browser extension",
      subcopy:
        "Approve the login signature in your Nostr extension. Your private key never leaves the signer.",
    };
  }, [isVerifying, signerFlow, showSlowSignHelp]);

  const steps: AuthStepItem[] = useMemo(() => {
    const isNip07 = signerFlow === "nip07";
    const s1: AuthStepItem = {
      id: "s1",
      label: isNip07 ? "Detecting extension" : "Remote signer ready",
      status: "complete",
    };
    const s2: AuthStepItem = {
      id: "s2",
      label: isNip07 ? "Requesting approval" : "Connection approved",
      status: "complete",
    };
    const s3: AuthStepItem = {
      id: "s3",
      label: "Signing you in",
      status: "active",
      description: isVerifying
        ? "Verifying with SmartFlowSocial…"
        : isNip07
          ? "Waiting for your extension to sign the login request."
          : "Waiting for your remote signer to complete signing.",
    };
    return [s1, s2, s3];
  }, [signerFlow, isVerifying]);

  const slowTips = showSlowSignHelp
    ? [
        "Unlock your extension if it's locked.",
        "Look for a popup blocked by the browser.",
        "Try canceling and signing in again if the prompt feels stuck.",
      ]
    : [];

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 min-h-[200px] space-y-4 duration-200"
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="flex items-start gap-3">
        <Loader2
          className="text-brand mt-0.5 h-5 w-5 shrink-0 animate-spin"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex min-h-6 flex-wrap items-center gap-x-1 gap-y-1 text-sm">
            <span className="text-text-secondary shrink-0">Signing in as</span>
            <span
              className="text-brand min-w-0 truncate font-semibold"
              title={signingInDisplayName ?? formatNpubShort(pubkey)}
            >
              {signingInDisplayName ?? formatNpubShort(pubkey)}
            </span>
          </div>
          <AuthProgressHeader headline={headline} subcopy={subcopy} />
        </div>
      </div>

      <AuthStepList steps={steps} />

      {slowTips.length > 0 ? <AuthInlineTipList items={slowTips} /> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          className="bg-brand text-brand-on hover:bg-brand/90 shadow-2 min-w-[160px] justify-center"
          disabled
        >
          {isVerifying ? "Verifying…" : "Waiting for signature…"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-border hover:bg-surface-hover hover:text-text"
          onClick={() => onCancel()}
          disabled={isVerifying}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
