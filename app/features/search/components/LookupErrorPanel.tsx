import { Search } from "lucide-react";

import { Button } from "~/components/ui/button";
import { StatusIcon } from "~/components/ui/status-icon";
import type { LookupLoaderErrorPayload } from "~/features/search";
import { cn } from "~/lib/utils";

export interface LookupErrorPanelProps {
  error: LookupLoaderErrorPayload;
  onNewLookup: () => void;
  onRetry?: () => void;
  className?: string;
}

export function LookupErrorPanel({
  error,
  onNewLookup,
  onRetry,
  className,
}: LookupErrorPanelProps) {
  const { code, message } = error;

  const title =
    code === "INVALID_INPUT"
      ? "Invalid input"
      : code === "NOT_FOUND"
        ? "Could not resolve content"
        : code === "UNSUPPORTED"
          ? "Unsupported object type"
          : code === "EXTERNAL_ERROR"
            ? "Service unavailable"
            : "Something went wrong";

  const body =
    code === "NOT_FOUND"
      ? "We recognized this identifier, but could not resolve the content. It may have been deleted, may be unavailable on connected relays, or may use an unsupported source."
      : code === "INVALID_INPUT"
        ? "Use a supported format: note1, nevent1, naddr1, 64-character hex event id, nostr:… prefix, or a supported Nostr URL."
        : code === "UNSUPPORTED"
          ? message
          : message;

  return (
    <div
      className={cn(
        "border-border bg-surface shadow-1 rounded-xl border p-6",
        className
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <StatusIcon tone="danger" size="lg" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-text text-base font-semibold">{title}</h2>
          <p className="text-text-secondary mt-2 text-sm leading-relaxed">
            {body}
          </p>
          {code === "NOT_FOUND" ? (
            <ul className="text-text-secondary mt-3 list-inside list-disc text-sm">
              <li>Deleted or not yet propagated</li>
              <li>Unavailable on connected relays / cache</li>
              <li>Unsupported or private source</li>
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onRetry}
              >
                Retry
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewLookup}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              New lookup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
