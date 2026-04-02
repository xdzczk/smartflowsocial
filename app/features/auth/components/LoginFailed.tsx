import { forwardRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  classifyErrorForRetry,
  getErrorSuggestions,
  getErrorTitle,
  type LoginError,
  type RelayStatus,
} from "~/features/auth/login-flow.client";

import { AuthInlineTipList } from "./auth-ui";

export interface LoginFailedProps {
  error: { code: LoginError; message: string; details?: string };
  relayStatuses: Record<string, RelayStatus>;
  relayUrls: string[];
  lastFailureOrigin: "nip07_init" | "nip46_init" | "verify" | null;
  nip46AttemptCount: number;
  onTryAgain: () => void;
  onBack: () => void;
  /** Offer remote signer when browser extension path is unlikely to succeed */
  showRemoteSignerFallback?: boolean;
  onUseRemoteSigner?: () => void;
}

export const LoginFailed = forwardRef<HTMLDivElement, LoginFailedProps>(
  function LoginFailed(
    {
      error,
      relayStatuses,
      relayUrls,
      lastFailureOrigin,
      nip46AttemptCount,
      onTryAgain,
      onBack,
      showRemoteSignerFallback = false,
      onUseRemoteSigner,
    },
    ref
  ) {
    const suggestions = getErrorSuggestions(error.code, {
      relayStatuses,
      retryCount:
        lastFailureOrigin === "nip46_init"
          ? Math.max(0, nip46AttemptCount - 1)
          : 0,
      lastFailureOrigin,
    });

    const classification = classifyErrorForRetry(error);
    const cappedTips = suggestions.slice(0, 5);

    return (
      <Alert
        ref={ref}
        tabIndex={-1}
        aria-live="assertive"
        variant="default"
        className="animate-in fade-in slide-in-from-bottom-1 border-destructive/45 bg-destructive/5 dark:bg-destructive/10 space-y-4 p-5 text-sm shadow-lg duration-200"
      >
        <AlertTitle className="text-destructive text-base">
          {getErrorTitle(error.code)}
        </AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-foreground/95 leading-relaxed">{error.message}</p>

          {cappedTips.length > 0 ? (
            <AuthInlineTipList intro="What to try" items={cappedTips} />
          ) : null}

          <details className="text-xs">
            <summary className="hover:text-foreground cursor-pointer font-medium select-none">
              Technical details
            </summary>
            <div className="mt-3 space-y-3">
              {error.details ? (
                <pre className="border-border bg-background dark:bg-card max-h-40 overflow-x-auto overflow-y-auto rounded-md border p-3 text-[11px] whitespace-pre-wrap">
                  {error.details}
                </pre>
              ) : (
                <p className="text-muted-foreground">No extra details.</p>
              )}

              {relayUrls.length > 0 ? (
                <div>
                  <div className="mb-1.5 font-medium">Relays last checked</div>
                  <div className="border-border bg-muted/40 space-y-1 rounded-md border p-2 text-[11px]">
                    {relayUrls.map((url) => {
                      const status = relayStatuses[url];
                      return (
                        <div key={url} className="flex justify-between gap-2">
                          <span className="truncate font-mono">{url}</span>
                          <span className="shrink-0">
                            {status?.status === "connected"
                              ? "OK"
                              : status?.status === "failed"
                                ? "Unreachable"
                                : "…"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="text-muted-foreground border-border/60 border-t pt-2 text-[11px]">
                Retry:{" "}
                {classification.shouldRetry ? "recommended" : "may not help"} ·
                Strategy: {classification.retryStrategy.replace(/_/g, " ")}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  void (async () => {
                    const errorText = `Error Code: ${error.code}\nMessage: ${error.message}\nDetails: ${error.details ?? "N/A"}\nTimestamp: ${new Date().toISOString()}`;
                    try {
                      await navigator.clipboard.writeText(errorText);
                    } catch {
                      const textarea = document.createElement("textarea");
                      textarea.value = errorText;
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand("copy");
                      document.body.removeChild(textarea);
                    }
                  })();
                }}
              >
                Copy for support
              </Button>
            </div>
          </details>

          <div className="flex flex-wrap gap-2 pt-1">
            {error.code === "SIGNER_NOT_FOUND" ? (
              <Button
                type="button"
                variant="outline"
                className="border-border"
                onClick={() => onBack()}
              >
                Back
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                  onClick={onTryAgain}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  onClick={() => onBack()}
                >
                  Back
                </Button>
              </>
            )}
            {showRemoteSignerFallback && onUseRemoteSigner ? (
              <Button
                type="button"
                variant="secondary"
                className="font-medium"
                onClick={() => onUseRemoteSigner()}
              >
                Use remote signer instead
              </Button>
            ) : null}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
);
