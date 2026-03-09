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
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-medium">Bunker input</div>
        <Input
          value={bunkerInput}
          onChange={(e) => onBunkerInputChange(e.target.value)}
          placeholder="bunker://..."
          disabled={disabled}
        />
      </div>
    </div>
  );
}
