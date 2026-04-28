import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { RelayStatus } from "~/features/auth/login-flow.client";

import { RelayCheckStatus } from "./RelayCheckStatus";

export interface LoginNip46FormProps {
  nip46Tab: "bunker" | "nostrconnect";
  setNip46Tab: (tab: "bunker" | "nostrconnect") => void;
  nip46Input: string;
  setNip46Input: (value: string) => void;
  relayList: string;
  setRelayList: (value: string) => void;
  onConnect: () => void;
  onCancel: () => void;
  relayStatuses: Record<string, RelayStatus>;
  relayUrls: string[];
  isConnectionInProgress: boolean;
  nostrConnectUri: string | null;
}

export function LoginNip46Form({
  nip46Tab,
  setNip46Tab,
  nip46Input,
  setNip46Input,
  relayList,
  setRelayList,
  onConnect,
  onCancel,
  relayStatuses,
  relayUrls,
  isConnectionInProgress,
  nostrConnectUri,
}: LoginNip46FormProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 space-y-6 duration-200">
      <div className="space-y-2">
        <p className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
          Remote signer
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          Connect with Amber, nsecBunker, or another NIP-46 signer. Your keys
          stay in the signer — we never ask for your private key.
        </p>
      </div>

      <div className="border-border/80 border-t pt-5">
        <Tabs
          value={nip46Tab}
          onValueChange={(v) => setNip46Tab(v as "bunker" | "nostrconnect")}
        >
          <TabsList className="border-border bg-surface-hover/80 h-auto w-full flex-wrap gap-1 p-1">
            <TabsTrigger
              value="bunker"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-on flex-1 px-3 py-2 text-sm"
            >
              Paste bunker input
            </TabsTrigger>
            <TabsTrigger
              value="nostrconnect"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-on flex-1 px-3 py-2 text-sm"
            >
              Generate nostrconnect URI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bunker" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nip46BunkerInput">Bunker input</Label>
              <Input
                id="nip46BunkerInput"
                name="nip46BunkerInput"
                value={nip46Input}
                onChange={(e) => setNip46Input(e.target.value)}
                placeholder="bunker+nostr://… or bunker://…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={onConnect}
                disabled={!nip46Input.trim() || isConnectionInProgress}
              >
                Connect
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onCancel()}
              >
                Back
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="nostrconnect" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nip46Relays">Relays</Label>
              <textarea
                id="nip46Relays"
                name="nip46Relays"
                aria-describedby="nip46RelaysHelp"
                className="focus-ring border-border bg-canvas shadow-1 min-h-[88px] w-full rounded-md border p-2 text-sm"
                value={relayList}
                onChange={(e) => setRelayList(e.target.value)}
              />
              <div id="nip46RelaysHelp" className="text-text-secondary text-xs">
                If approval gets stuck, remove unreachable relays or add
                alternatives.
              </div>
              {relayUrls.length > 0 ? (
                <RelayCheckStatus
                  relayUrls={relayUrls}
                  relayStatuses={relayStatuses}
                  title="Relay connectivity"
                />
              ) : null}
            </div>

            {nostrConnectUri ? (
              <div className="space-y-1.5">
                <Label htmlFor="nip46NostrConnectUri">nostrconnect URI</Label>
                <textarea
                  id="nip46NostrConnectUri"
                  readOnly
                  className="border-border bg-canvas shadow-1 min-h-[88px] w-full rounded-md border p-2 text-sm"
                  value={nostrConnectUri}
                />
                <div className="text-text-secondary text-xs">
                  Approve in your remote signer, then keep this page open while
                  we finish connecting.
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={onConnect}
                disabled={isConnectionInProgress}
              >
                {nostrConnectUri ? "Retry" : "Generate & wait"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onCancel()}
              >
                Back
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
