import { Shield, Wallet, XCircle, Zap } from "lucide-react";

const ITEMS = [
  { icon: Wallet, label: "Non-custodial payments" },
  { icon: Shield, label: "SmartFlow never holds your funds" },
  { icon: XCircle, label: "Cancel anytime" },
  { icon: Zap, label: "Access activates after payment" },
] as const;

export function TrustStrip(): React.ReactElement {
  return (
    <div
      className="border-border bg-muted/30 text-muted-foreground flex flex-wrap items-center gap-2 border-y py-3 text-xs"
      role="list"
    >
      {ITEMS.map(({ icon: Icon, label }) => (
        <span
          key={label}
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
        >
          <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
