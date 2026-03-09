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
    <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl">
      <div className="space-y-2">
        <div className="text-foreground text-base font-bold">Remote signer</div>
        <div className="text-muted-foreground text-sm leading-relaxed">
          Connect a remote signer and approve a profile. Each profile represents
          a different identity (pubkey).
        </div>
      </div>

      <Tabs
        value={nip46Tab}
        onValueChange={(v) => setNip46Tab(v as "bunker" | "nostrconnect")}
      >
        <TabsList className="border-border bg-muted w-full">
          <TabsTrigger
            value="bunker"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1"
          >
            Paste bunker input
          </TabsTrigger>
          <TabsTrigger
            value="nostrconnect"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1"
          >
            Generate nostrconnect URI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bunker" className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="nip46BunkerInput">Bunker input</Label>
            <Input
              id="nip46BunkerInput"
              name="nip46BunkerInput"
              value={nip46Input}
              onChange={(e) => setNip46Input(e.target.value)}
              placeholder="bunker://..."
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onConnect}
              disabled={!nip46Input.trim() || isConnectionInProgress}
            >
              Connect
            </Button>
            <Button type="button" variant="outline" onClick={() => onCancel()}>
              Cancel
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="nostrconnect" className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="nip46Relays">Relays</Label>
            <textarea
              id="nip46Relays"
              name="nip46Relays"
              aria-describedby="nip46RelaysHelp"
              className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
              value={relayList}
              onChange={(e) => setRelayList(e.target.value)}
            />
            <div id="nip46RelaysHelp" className="text-muted-foreground text-xs">
              If approval gets stuck, try removing unreachable relays or add
              alternatives.
            </div>
            {relayUrls.length > 0 ? (
              <RelayCheckStatus
                relayUrls={relayUrls}
                relayStatuses={relayStatuses}
                title="Relay status (best-effort connectivity check):"
              />
            ) : null}
          </div>

          {nostrConnectUri ? (
            <div className="space-y-1">
              <Label htmlFor="nip46NostrConnectUri">nostrconnect URI</Label>
              <textarea
                id="nip46NostrConnectUri"
                readOnly
                className="border-input bg-background min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm"
                value={nostrConnectUri}
              />
              <div className="text-muted-foreground text-xs">
                Paste this into your remote signer to approve. Then return here
                and wait for approval.
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onConnect}
              disabled={isConnectionInProgress}
            >
              {nostrConnectUri ? "Retry" : "Generate & wait"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onCancel()}>
              Cancel
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
