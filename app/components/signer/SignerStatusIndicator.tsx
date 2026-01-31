/**
 * Footer signer status: NIP-46 remote signer health or NIP-07 extension readiness.
 * Avoids hydration mismatch by applying client-only state after mount.
 */

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
} from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";

import type { Nip07Readiness } from "~/lib/nip07-readiness.client";
import { getActiveSignerConfig } from "~/lib/nostr-signer-manager.client";
import { getActiveSession } from "~/lib/remote-signer-sessions.client";
import type { ConnectionStatus } from "~/lib/remote-signer-sessions.client";
import { useNip07Readiness } from "~/lib/useNip07Readiness.client";

function Nip46Status({ status }: { status: ConnectionStatus }) {
  if (status === "active") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <CheckCircleIcon className="h-3 w-3 text-green-500" />
        <span className="hidden sm:inline">Active</span>
      </div>
    );
  }
  if (status === "stale") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500" />
        <span className="hidden sm:inline">Stale</span>
      </div>
    );
  }
  if (status === "disconnected") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <NoSymbolIcon className="h-3 w-3 opacity-60" />
        <span className="hidden sm:inline">Disconnected</span>
      </div>
    );
  }
  // status is "inactive" (only remaining ConnectionStatus after active, stale, disconnected)
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <NoSymbolIcon className="h-3 w-3 opacity-60" />
      <span className="hidden sm:inline">Inactive</span>
    </div>
  );
}

function Nip07Status({ readiness }: { readiness: Nip07Readiness }) {
  if (readiness === "ready") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <CheckCircleIcon className="h-3 w-3 text-green-500" />
        <span className="hidden sm:inline">Extension ready</span>
      </div>
    );
  }
  if (readiness === "unresponsive") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500" />
        <span className="hidden sm:inline">Extension unresponsive</span>
      </div>
    );
  }
  if (readiness === "account_mismatch") {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
        <span className="hidden sm:inline">Wrong account</span>
      </div>
    );
  }
  // unknown or any other state
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <div className="bg-muted-foreground/40 h-3 w-3 rounded-full" />
      <span className="hidden sm:inline">Extension…</span>
    </div>
  );
}

export function SignerStatusIndicator() {
  const [mounted, setMounted] = useState(false);
  const nip07Readiness = useNip07Readiness();

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!mounted) {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <div className="bg-muted-foreground/40 h-3 w-3 rounded-full" />
      </div>
    );
  }

  const config = getActiveSignerConfig();
  if (!config) {
    return (
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <NoSymbolIcon className="h-3 w-3 opacity-50" />
        <span className="hidden sm:inline">No signer</span>
      </div>
    );
  }

  if (config.type === "nip46") {
    const session = getActiveSession();
    const status = session?.metadata.status ?? "inactive";
    return <Nip46Status status={status} />;
  }

  return <Nip07Status readiness={nip07Readiness} />;
}
