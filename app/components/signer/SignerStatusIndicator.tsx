/**
 * Footer signer status: NIP-46 remote signer health or NIP-07 extension readiness.
 * Avoids hydration mismatch by applying client-only state after mount.
 */

import { Ban } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusIcon } from "~/components/ui/status-icon";
import {
  getActiveConnection,
  getActiveSignerConfig,
  SIGNER_CONFIG_HYDRATED_EVENT,
  type ConnectionStatus,
} from "~/features/auth/signer";
import {
  type Nip07Readiness,
  useNip07Readiness,
} from "~/lib/useNip07Readiness";

const MAX_ACTIVE_IDLE_MS = 5 * 60 * 1000;

function getDisplayStatus(
  status: ConnectionStatus,
  lastActivityAt: number | null
): ConnectionStatus {
  if (status !== "active") return status;
  if (!lastActivityAt) return "stale";
  if (Date.now() - lastActivityAt > MAX_ACTIVE_IDLE_MS) return "stale";
  return "active";
}

function Nip46Status({ status }: { status: ConnectionStatus }) {
  if (status === "active") {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <StatusIcon tone="success" size="xs" />
        <span className="hidden sm:inline">Active</span>
      </div>
    );
  }
  if (status === "stale") {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <StatusIcon tone="warning" size="xs" />
        <span className="hidden sm:inline">Stale</span>
      </div>
    );
  }
  // status is "disconnected" or "inactive" — visually neutral, both rendered the
  // same way; the label distinguishes them.
  return (
    <div className="text-text-secondary cluster-tight text-xs">
      <StatusIcon tone="neutral" size="xs" icon={Ban} className="opacity-60" />
      <span className="hidden sm:inline">
        {status === "disconnected" ? "Disconnected" : "Inactive"}
      </span>
    </div>
  );
}

function Nip07Status({ readiness }: { readiness: Nip07Readiness }) {
  if (readiness === "ready") {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <StatusIcon tone="success" size="xs" />
        <span className="hidden sm:inline">Extension ready</span>
      </div>
    );
  }
  if (readiness === "unresponsive") {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <StatusIcon tone="warning" size="xs" />
        <span className="hidden sm:inline">Extension unresponsive</span>
      </div>
    );
  }
  if (readiness === "account_mismatch") {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <StatusIcon tone="warning" size="xs" />
        <span className="hidden sm:inline">Wrong account</span>
      </div>
    );
  }
  return (
    <div className="text-text-secondary cluster-tight text-xs">
      <div className="bg-surface-hover-foreground/40 h-3 w-3 rounded-full" />
      <span className="hidden sm:inline">Extension…</span>
    </div>
  );
}

export function SignerStatusIndicator() {
  const [mounted, setMounted] = useState(false);
  const [, setHydrationTick] = useState(0);
  const nip07Readiness = useNip07Readiness();

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const handler = () => setHydrationTick((n) => n + 1);
    window.addEventListener(SIGNER_CONFIG_HYDRATED_EVENT, handler);
    return () =>
      window.removeEventListener(SIGNER_CONFIG_HYDRATED_EVENT, handler);
  }, []);

  if (!mounted) {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <div className="bg-surface-hover-foreground/40 h-3 w-3 rounded-full" />
      </div>
    );
  }

  const config = getActiveSignerConfig();
  if (!config) {
    return (
      <div className="text-text-secondary cluster-tight text-xs">
        <StatusIcon
          tone="neutral"
          size="xs"
          icon={Ban}
          className="opacity-50"
        />
        <span className="hidden sm:inline">No signer</span>
      </div>
    );
  }

  if (config.type === "nip46") {
    const connection = getActiveConnection();
    const status = getDisplayStatus(
      connection?.metadata.status ?? "inactive",
      connection?.metadata.lastActivityAt ?? null
    );
    return <Nip46Status status={status} />;
  }

  return <Nip07Status readiness={nip07Readiness} />;
}
