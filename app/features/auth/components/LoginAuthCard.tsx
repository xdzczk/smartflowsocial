import type { ReactNode } from "react";

import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import { useLoginAuthShell } from "./LoginAuthShellContext";

function DefaultRightPanel() {
  return (
    <div className="relative z-10 space-y-4 text-center sm:text-left">
      <div className="space-y-2">
        <h2 className="text-text text-lg font-bold tracking-tight sm:text-xl">
          Sign in with your Nostr signer
        </h2>
        <p className="text-text/90 text-sm leading-relaxed sm:text-base">
          Your keys stay with your extension or remote signer.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          SmartFlowSocial never asks for your private key.
        </p>
      </div>
      <ul className="text-text/85 space-y-2.5 text-sm leading-snug">
        <li className="flex gap-2">
          <span className="text-link font-bold" aria-hidden>
            ·
          </span>
          <span>Native Nostr authentication</span>
        </li>
        <li className="flex gap-2">
          <span className="text-link font-bold" aria-hidden>
            ·
          </span>
          <span>Browser extension and remote signer supported</span>
        </li>
        <li className="flex gap-2">
          <span className="text-link font-bold" aria-hidden>
            ·
          </span>
          <span>Fast access to your publishing dashboard</span>
        </li>
      </ul>
    </div>
  );
}

export function LoginAuthCard({ children }: { children: ReactNode }) {
  const { rightPanel, isAwaitingApproval } = useLoginAuthShell();

  return (
    <Card
      className={cn(
        "border-border ring-border/45 shadow-3 dark:shadow-3 flex min-h-0 w-full min-w-0 flex-col overflow-hidden ring-1 md:min-h-[min(440px,70vh)] md:flex-row dark:ring-0",
        /* Mobile: show QR / approval block first when waiting for NIP-46 */
        isAwaitingApproval && "max-md:flex-col-reverse"
      )}
    >
      <CardContent
        className={cn(
          "flex w-full min-w-0 flex-col p-6 md:min-h-0 md:min-w-0 md:flex-[1_1_0] md:overflow-y-auto md:p-10 lg:p-16",
          !isAwaitingApproval && "border-border/70 md:border-r"
        )}
      >
        {children}
      </CardContent>

      <div
        className={cn(
          "login-motif-panel hero-motif-bg relative flex w-full min-w-0 shrink-0 flex-col items-center justify-center px-6 py-10 md:min-h-0 md:flex-[1_1_0] md:self-stretch md:px-10 lg:p-16",
          /* Keep a compact trust panel on mobile, but don't clamp awaiting approval QR UI. */
          "min-h-[200px] md:min-h-full",
          !isAwaitingApproval && "max-md:max-h-[min(40vh,320px)]",
          isAwaitingApproval &&
            "border-border/60 bg-surface-hover/25 dark:bg-surface-hover/10 md:border-border/60 border-t md:border-t-0 md:border-l"
        )}
      >
        {isAwaitingApproval ? (
          <div
            className="from-canvas/50 to-canvas/80 dark:from-canvas/40 dark:to-canvas/70 pointer-events-none absolute inset-0 bg-gradient-to-b"
            aria-hidden
          />
        ) : null}
        <div className="relative z-10 w-full max-w-md transition-all duration-200 ease-out">
          {rightPanel ? (
            <div
              key="approval"
              className="animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              {rightPanel}
            </div>
          ) : (
            <div key="brand" className="animate-in fade-in duration-200">
              <DefaultRightPanel />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
