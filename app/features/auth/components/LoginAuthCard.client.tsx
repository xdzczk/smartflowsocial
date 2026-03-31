import type { ReactNode } from "react";

import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import { useLoginAuthShell } from "./LoginAuthShellContext.client";

function DefaultRightPanel() {
  return (
    <div className="relative z-10 text-center sm:text-left">
      <p className="text-foreground mb-2 text-lg leading-relaxed font-bold sm:text-xl">
        Sign in securely using your{" "}
        <span className="text-primary">Nostr identity</span>
      </p>
      <p className="text-muted-foreground text-sm font-medium sm:text-base">
        Powered by Nostr protocol
      </p>
    </div>
  );
}

export function LoginAuthCard({ children }: { children: ReactNode }) {
  const { rightPanel, isAwaitingApproval } = useLoginAuthShell();

  return (
    <Card
      className={cn(
        "border-border flex flex-col overflow-hidden shadow-xl md:flex-row dark:shadow-2xl",
        isAwaitingApproval && "flex-col-reverse md:flex-row"
      )}
    >
      <CardContent className="flex flex-1 flex-col p-6 md:min-w-0 md:flex-[1_1_0] md:p-10 lg:p-16">
        {children}
      </CardContent>

      <div
        className={cn(
          "hero-motif-bg relative flex min-h-[200px] flex-1 flex-col items-center justify-center px-6 py-10 md:min-h-full md:flex-[1_1_0] md:px-10 lg:p-16",
          isAwaitingApproval &&
            "border-border/60 bg-muted/20 dark:bg-muted/10 border-t md:border-t-0 md:border-l"
        )}
      >
        {isAwaitingApproval ? (
          <div
            className="from-background/50 to-background/80 dark:from-background/40 dark:to-background/70 pointer-events-none absolute inset-0 bg-gradient-to-b"
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
