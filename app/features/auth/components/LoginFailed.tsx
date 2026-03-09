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

export interface LoginFailedProps {
  error: { code: LoginError; message: string; details?: string };
  relayStatuses: Record<string, RelayStatus>;
  relayUrls: string[];
  lastFailureOrigin: "nip07_init" | "nip46_init" | "verify" | null;
  nip46AttemptCount: number;
  onTryAgain: () => void;
  onBack: () => void;
  errorRegionRef?: React.RefObject<HTMLDivElement | null>;
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
      errorRegionRef,
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

    return (
      <Alert
        ref={errorRegionRef ?? ref}
        tabIndex={-1}
        aria-live="assertive"
        variant="destructive"
        className="space-y-3 p-5 text-sm shadow-lg"
      >
        <AlertTitle>{getErrorTitle(error.code)}</AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="leading-relaxed">{error.message}</div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs">
            {suggestions.map((s) => (
              <li key={s} className="leading-relaxed">
                {s}
              </li>
            ))}
          </ul>

          <details className="text-xs">
            <summary className="hover:text-foreground cursor-pointer font-medium select-none">
              Advanced Troubleshooting
            </summary>
            <div className="mt-3 space-y-3">
              {error.details ? (
                <div>
                  <div className="mb-1 font-medium">Technical Details:</div>
                  <pre className="border-border bg-background dark:bg-card overflow-x-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                    {error.details}
                  </pre>
                </div>
              ) : null}

              <div>
                <div className="mb-1 font-medium">Error Classification:</div>
                <div className="border-border bg-muted/50 dark:bg-muted/30 rounded-md border p-2 text-xs">
                  <div className="space-y-1">
                    <div>
                      <span className="font-medium">Type: </span>
                      {classification.isNetworkError ? "Network Error" : null}
                      {classification.isTimeoutError ? "Timeout Error" : null}
                      {classification.isPermissionError
                        ? "Permission Error"
                        : null}
                      {!classification.isNetworkError &&
                      !classification.isTimeoutError &&
                      !classification.isPermissionError
                        ? "Other Error"
                        : null}
                    </div>
                    <div>
                      <span className="font-medium">Retry Strategy: </span>
                      {classification.retryStrategy === "exponential_backoff"
                        ? "Exponential Backoff"
                        : null}
                      {classification.retryStrategy === "progressive_timeout"
                        ? "Progressive Timeout"
                        : null}
                      {classification.retryStrategy === "none"
                        ? "No Auto-Retry"
                        : null}
                    </div>
                    <div>
                      <span className="font-medium">Should Retry: </span>
                      {classification.shouldRetry ? "Yes" : "No"}
                    </div>
                  </div>
                </div>
              </div>

              {relayUrls.length > 0 ? (
                <div>
                  <div className="mb-1 font-medium">Relay Status:</div>
                  <div className="border-border bg-muted/50 dark:bg-muted/30 space-y-1 rounded-md border p-2 text-xs">
                    {relayUrls.map((url) => {
                      const status = relayStatuses[url];
                      return (
                        <div key={url} className="flex justify-between">
                          <span className="truncate font-mono">{url}</span>
                          <span className="ml-2 shrink-0">
                            {status?.status === "connected"
                              ? "✓ Connected"
                              : status?.status === "failed"
                                ? "✗ Failed"
                                : "… Checking"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-1 font-medium">Copy Error for Support:</div>
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
                        alert("Error details copied to clipboard");
                      } catch {
                        const textarea = document.createElement("textarea");
                        textarea.value = errorText;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        alert("Error details copied to clipboard");
                      }
                    })();
                  }}
                >
                  Copy Error Details
                </Button>
              </div>
            </div>
          </details>
          <div className="flex gap-3 pt-2">
            {error.code === "SIGNER_NOT_FOUND" ? (
              <Button
                type="button"
                variant="outline"
                className="border-border bg-card hover:bg-muted hover:text-foreground"
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
                  className="border-border bg-card hover:bg-muted hover:text-foreground"
                  onClick={() => onBack()}
                >
                  Back
                </Button>
              </>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
);
