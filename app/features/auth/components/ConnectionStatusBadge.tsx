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
          className: "bg-muted text-muted-foreground",
        };
      case "stale":
        return {
          label: "Needs reconnection",
          className:
            "bg-destructive/10 text-destructive border border-destructive/20",
        };
      case "inactive":
        return {
          label: "Inactive",
          className: "bg-muted/50 text-muted-foreground",
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
