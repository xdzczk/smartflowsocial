import { cn } from "~/lib/utils";

export type AudienceSourceTab = "mutuals" | "custom" | "saved";

const OPTIONS: Array<{
  id: AudienceSourceTab;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    id: "mutuals",
    title: "Mutuals",
    description:
      "Accounts you follow that follow you back. Lower spam risk — best for direct updates.",
    recommended: true,
  },
  {
    id: "custom",
    title: "Custom list",
    description:
      "Paste, import, or search specific recipients. Only accounts that follow you can receive the DM.",
  },
  {
    id: "saved",
    title: "Saved audience",
    description: "Reuse a saved audience definition from your library.",
  },
];

export interface AudienceSourceSelectorProps {
  value: AudienceSourceTab;
  onChange: (v: AudienceSourceTab) => void;
  disabled?: boolean;
  /** Hide graph options (e.g. basic plan). */
  allowGraph: boolean;
  allowSaved: boolean;
}

export function AudienceSourceSelector({
  value,
  onChange,
  disabled,
  allowGraph,
  allowSaved,
}: AudienceSourceSelectorProps) {
  const visible = OPTIONS.filter((o) => {
    if (o.id === "mutuals") return allowGraph;
    if (o.id === "saved") return allowSaved;
    return true;
  });

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Audience source</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(opt.id);
            }}
            className={cn(
              "border-border rounded-lg border p-3 text-left text-sm transition-colors",
              value === opt.id
                ? "border-primary bg-primary/5 ring-primary ring-2"
                : "hover:bg-muted/50",
              disabled && "opacity-50"
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              {opt.title}
              {opt.recommended ? (
                <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                  Recommended
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-snug">
              {opt.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
