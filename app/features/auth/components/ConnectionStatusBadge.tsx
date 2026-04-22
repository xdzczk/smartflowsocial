import { Badge } from "~/components/ui/badge";
import type { ConnectionStatus } from "~/features/auth/signer";

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

export function ConnectionStatusBadge({
  status,
  className,
}: ConnectionStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "active":
        return {
          label: "Connected",
          className: "bg-success text-success-foreground",
        };
      case "disconnected":
        return {
          label: "Inactive",
          className: "bg-surface-hover text-text-secondary",
        };
      case "stale":
        return {
          label: "Needs reconnection",
          className: "bg-danger/10 text-danger border border-danger/20",
        };
      case "inactive":
        return {
          label: "Inactive",
          className: "bg-surface-hover/50 text-text-secondary",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge className={`${config.className} ${className ?? ""}`}>
      {config.label}
    </Badge>
  );
}
