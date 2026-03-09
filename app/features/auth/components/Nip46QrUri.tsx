import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

export interface Nip46QrUriProps {
  /** nostrconnect URI to display and encode in QR */
  uri: string;
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
}

/** NIP-46 QR code and Nostr Connect URI display with copy button. */
export function Nip46QrUri({
  uri,
  onCopy,
  copyOk,
  label = "nostrconnect URI",
  textareaId = "nip46NostrConnectUri",
  children,
  helperText,
  className,
}: Nip46QrUriProps) {
  return (
    <div className={className ?? "space-y-4 pt-2"}>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div className="border-border bg-background dark:bg-card flex justify-center rounded-lg border p-4 shadow-md">
          <QRCode value={uri} size={168} />
        </div>
        <div className="space-y-3">
          <Label htmlFor={textareaId} className="text-sm font-semibold">
            {label}
          </Label>
          <textarea
            id={textareaId}
            readOnly
            className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
            value={uri}
          />
          {helperText ? (
            <div className="text-muted-foreground text-xs">{helperText}</div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card hover:bg-muted hover:text-foreground"
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
