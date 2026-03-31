import { RefreshCw } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import type {
  ConnectionLogEntry,
  RemoteSignerConnection,
} from "~/features/auth/signer";

import { ConnectionHistory } from "./ConnectionHistory";

interface RemoteSignerHealthSectionProps {
  activeConnection: RemoteSignerConnection;
  isTestingConnection: boolean;
  onTestConnection: () => void;
  onDisconnect: () => void;
  getConnectionHistory: (connectionId: string) => ConnectionLogEntry[];
}

export function RemoteSignerHealthSection({
  activeConnection,
  isTestingConnection,
  onTestConnection,
  onDisconnect,
  getConnectionHistory,
}: RemoteSignerHealthSectionProps) {
  const entries = getConnectionHistory(activeConnection.id).slice(0, 5);

  return (
    <div>
      <div className="mb-1">
        <h3 className="text-foreground mb-1 text-base font-semibold">
          Active signer session
        </h3>
        <p className="text-muted-foreground mb-3 text-xs">
          Runtime health and recent events for the signer you&apos;re using now.
        </p>
        <div className="bg-muted/30 rounded-md border p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-medium">{activeConnection.label}</div>
              <div className="text-muted-foreground text-sm break-words">
                {activeConnection.metadata.signerAppName ?? "Unknown signer"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTestConnection()}
                disabled={isTestingConnection}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isTestingConnection ? "animate-spin" : ""}`}
                />
                Test connection
              </Button>
              <Button size="sm" variant="outline" onClick={onDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>

          <Separator className="my-3" />
          <div>
            <h4 className="mb-2 text-sm font-medium">Recent events</h4>
            <ConnectionHistory entries={entries} />
          </div>
        </div>
      </div>
    </div>
  );
}
