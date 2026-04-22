import type { Nip65RelayScope } from "~/features/relays/nip65-relay-entry";

export function formatAck(
  ack:
    | { status: string; createdAt: string; receivedAt: string | null }
    | undefined
): string {
  if (!ack) return "—";
  const status = ack.status.toLowerCase();
  const at = ack.createdAt ? new Date(ack.createdAt).toLocaleString() : "";
  return at ? `${status} (${at})` : status;
}

export function scopeLabel(scope: Nip65RelayScope): string {
  switch (scope) {
    case "both":
      return "Read & write";
    case "read":
      return "Read only";
    case "write":
      return "Write only";
    default:
      return scope;
  }
}

export function settingsSubsectionClassName(): string {
  return "border-border/80 bg-surface-hover/15 rounded-lg border px-4 py-4 sm:px-5 sm:py-5";
}
