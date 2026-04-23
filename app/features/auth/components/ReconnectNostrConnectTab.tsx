import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { isAndroid, isMobile } from "~/lib/is-mobile";

import { AmberLoginIcon } from "./AmberLoginIcon";
import { PrimalLogoIcon } from "./PrimalLogoIcon";

export interface ReconnectNostrConnectTabProps {
  relayList: string;
  onRelayListChange: (value: string) => void;
  nostrConnectUri: string | null;
  onCopyUri: () => void;
  copyOk: boolean;
  onLoginWithPrimal: () => void;
  onLoginWithAmber: () => void;
  disabled: boolean;
}

export function ReconnectNostrConnectTab({
  relayList,
  onRelayListChange,
  nostrConnectUri,
  onCopyUri,
  copyOk,
  onLoginWithPrimal,
  onLoginWithAmber,
  disabled,
}: ReconnectNostrConnectTabProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Relay routing</h4>
        <div className="space-y-1">
          <div className="text-sm font-medium">Connection relays</div>
          <p className="text-text-secondary text-xs">
            These relays are used to establish and maintain the signer
            connection.
          </p>
          <textarea
            className="border-border bg-canvas focus-visible:ring-focus-ring shadow-1 min-h-[88px] w-full rounded-md border p-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
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
            <div className="bg-surface flex justify-center rounded-md border p-3">
              <QRCode value={nostrConnectUri} size={176} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Link for your signer app
              </div>
              <textarea
                readOnly
                className="border-border bg-canvas shadow-1 min-h-[88px] w-full rounded-md border p-2 text-sm"
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
                {isMobile() && isAndroid() ? (
                  <>
                    <Button type="button" onClick={onLoginWithAmber}>
                      <span className="cluster">
                        <AmberLoginIcon className="size-5 shrink-0" />
                        Login with Amber
                      </span>
                    </Button>
                    <Button type="button" onClick={onLoginWithPrimal}>
                      <span className="cluster">
                        <PrimalLogoIcon className="size-5 shrink-0" />
                        Login with Primal
                      </span>
                    </Button>
                  </>
                ) : isMobile() ? (
                  <Button type="button" onClick={onLoginWithPrimal}>
                    <span className="cluster">
                      <PrimalLogoIcon className="size-5 shrink-0" />
                      Login with Primal
                    </span>
                  </Button>
                ) : null}
              </div>
              <p className="text-text-secondary text-xs">
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
