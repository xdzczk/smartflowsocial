import { Loader2 } from "lucide-react";

export interface LoginGenericLoadingProps {
  message: string;
}

export function LoginGenericLoading({ message }: LoginGenericLoadingProps) {
  return (
    <div
      className="border-border bg-card min-h-[164px] space-y-3 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="text-primary h-5 w-5 animate-spin" />
        <div className="text-foreground text-base font-semibold">{message}</div>
      </div>
    </div>
  );
}
