import { Shield, Wallet, XCircle, Zap } from "lucide-react";

import { BRAND_NAME } from "~/lib/brand";

export function TrustStrip(): React.ReactElement {
  const items = [
    { icon: Wallet, label: "Non-custodial payments" },
    { icon: Shield, label: `${BRAND_NAME} never holds your funds` },
    { icon: XCircle, label: "Cancel anytime" },
    { icon: Zap, label: "Access activates after payment" },
  ];
  return (
    <div
      className="border-border bg-surface-hover/30 text-text-secondary flex flex-wrap items-center gap-2 border-y py-3 text-xs"
      role="list"
    >
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
        >
          <Icon className="text-text-secondary h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
