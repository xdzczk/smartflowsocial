import { ScanLine } from "lucide-react";
import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

export type Nip46QrUriVariant = "inline" | "approval";

export interface Nip46QrUriProps {
  /** nostrconnect URI to display and encode in QR */
  uri: string | null;
  /** inline = side-by-side grid (default); approval = large QR stack for login waiting state */
  variant?: Nip46QrUriVariant;
  /** Called when user clicks Copy */
  onCopy: () => void;
  /** When true, show "Copied" instead of "Copy" */
  copyOk: boolean;
  /** Optional label for the URI field */
  label?: string;
  /** Optional id for the textarea (a11y) */
  textareaId?: string;
  /** Optional slot after the copy button (e.g. "Login with Primal" button) */
  children?: React.ReactNode;
  /** Optional helper text below the URI */
  helperText?: string;
  className?: string;
  /** Approval panel: main heading above QR */
  approvalHeading?: string;
  /** Approval panel: line under heading */
  approvalSubtext?: string;
}

const QR_APPROVAL_SIZE = 280;
const QR_INLINE_SIZE = 168;

/** NIP-46 QR code and Nostr Connect URI display with copy button. */
export function Nip46QrUri({
  uri,
  variant = "inline",
  onCopy,
  copyOk,
  label = "nostrconnect URI",
  textareaId = "nip46NostrConnectUri",
  children,
  helperText,
  className,
  approvalHeading = "Scan to approve",
  approvalSubtext = "Use your remote signer to scan or paste the URI below.",
}: Nip46QrUriProps) {
  if (variant === "approval") {
    return (
      <div
        className={cn(
          "flex w-full flex-col items-center gap-6 text-center",
          className
        )}
      >
        <div className="space-y-2">
          <div className="text-text flex items-center justify-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <ScanLine
              className="text-brand size-5 shrink-0 opacity-90"
              aria-hidden
            />
            <span>{approvalHeading}</span>
          </div>
          <p className="text-text-secondary max-w-sm text-sm leading-snug">
            {approvalSubtext}
          </p>
        </div>

        <div
          className={cn(
            "border-border shadow-2 flex min-h-[min(260px,78vw)] w-full max-w-[300px] items-center justify-center rounded-xl border bg-white p-4 sm:min-h-[min(320px,85vw)] sm:p-6",
            "dark:border-white/10 dark:bg-white dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_40px_-12px_rgba(0,0,0,0.45)]"
          )}
        >
          {uri ? (
            <QRCode
              value={uri}
              size={QR_APPROVAL_SIZE}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          ) : (
            <div
              className="bg-surface-hover/80 flex aspect-square w-full max-w-[280px] animate-pulse rounded-md"
              aria-hidden
            />
          )}
        </div>

        <div className="w-full max-w-md space-y-3 text-left">
          <Label
            htmlFor={textareaId}
            className="text-text text-xs font-semibold"
          >
            {label}
          </Label>
          {uri ? (
            <input
              id={textareaId}
              readOnly
              value={uri}
              className="border-border bg-canvas focus-visible:ring-focus-ring shadow-1 w-full truncate rounded-md border px-3 py-2.5 font-mono text-xs focus-visible:ring-1 focus-visible:outline-none"
            />
          ) : (
            <div
              className="border-border bg-surface-hover/40 h-10 w-full animate-pulse rounded-md border"
              aria-hidden
            />
          )}
          {helperText ? (
            <div className="text-text-secondary text-xs">{helperText}</div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border bg-canvas/80 hover:bg-surface-hover hover:text-text"
              onClick={onCopy}
              disabled={!uri}
            >
              {copyOk ? "Copied" : "Copy"}
            </Button>
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (!uri) return null;

  return (
    <div className={className ?? "space-y-4 pt-2"}>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div className="border-border shadow-2 dark:shadow-1 flex justify-center rounded-lg border bg-white p-4 dark:bg-white">
          <QRCode value={uri} size={QR_INLINE_SIZE} />
        </div>
        <div className="space-y-3">
          <Label htmlFor={textareaId} className="text-sm font-semibold">
            {label}
          </Label>
          <textarea
            id={textareaId}
            readOnly
            className="border-border bg-canvas focus-visible:ring-focus-ring shadow-1 min-h-[88px] w-full rounded-md border p-3 text-sm focus-visible:ring-1 focus-visible:outline-none"
            value={uri}
          />
          {helperText ? (
            <div className="text-text-secondary text-xs">{helperText}</div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="border-border bg-surface hover:bg-surface-hover hover:text-text"
              onClick={onCopy}
            >
              {copyOk ? "Copied" : "Copy"}
            </Button>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
