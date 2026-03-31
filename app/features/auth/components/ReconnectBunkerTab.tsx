import { Input } from "~/components/ui/input";

export interface ReconnectBunkerTabProps {
  bunkerInput: string;
  onBunkerInputChange: (value: string) => void;
  disabled: boolean;
}

export function ReconnectBunkerTab({
  bunkerInput,
  onBunkerInputChange,
  disabled,
}: ReconnectBunkerTabProps) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Paste a bunker or NIP-46 connection string from your signer app.
      </p>
      <div className="space-y-1">
        <div className="text-sm font-medium">Signer connection</div>
        <Input
          value={bunkerInput}
          onChange={(e) => onBunkerInputChange(e.target.value)}
          placeholder="bunker://..."
          disabled={disabled}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
