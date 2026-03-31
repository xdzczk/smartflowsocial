import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { isMobile } from "~/lib/is-mobile";

import { PrimalLogoIcon } from "./PrimalLogoIcon";

export interface ReconnectNostrConnectTabProps {
  relayList: string;
  onRelayListChange: (value: string) => void;
  nostrConnectUri: string | null;
  onCopyUri: () => void;
  copyOk: boolean;
  onLoginWithPrimal: () => void;
  disabled: boolean;
}

export function ReconnectNostrConnectTab({
  relayList,
  onRelayListChange,
  nostrConnectUri,
  onCopyUri,
  copyOk,
  onLoginWithPrimal,
  disabled,
}: ReconnectNostrConnectTabProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Relay routing</h4>
        <div className="space-y-1">
          <div className="text-sm font-medium">Connection relays</div>
          <p className="text-muted-foreground text-xs">
            These relays are used to establish and maintain the signer
            connection.
          </p>
          <textarea
            className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
            value={relayList}
            onChange={(e) => onRelayListChange(e.target.value)}
            disabled={disabled}
            aria-label="Connection relays"
          />
        </div>
      </div>

      {nostrConnectUri ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Connection link</h4>
          <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
            <div className="dark:bg-card/30 flex justify-center rounded-md border bg-white p-3">
              <QRCode value={nostrConnectUri} size={176} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Link for your signer app
              </div>
              <textarea
                readOnly
                className="border-input bg-background min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm"
                value={nostrConnectUri}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCopyUri()}
                >
                  {copyOk ? "Copied" : "Copy"}
                </Button>
                {isMobile() ? (
                  <Button type="button" onClick={onLoginWithPrimal}>
                    <span className="flex items-center gap-2">
                      <PrimalLogoIcon className="size-5 shrink-0" />
                      Login with Primal
                    </span>
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                Scan the QR code or paste the link into your signer app (Nostr
                Connect) to approve.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
