import { Loader2 } from "lucide-react";

export interface LoginGenericLoadingProps {
  message: string;
}

export function LoginGenericLoading({ message }: LoginGenericLoadingProps) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 flex min-h-[120px] items-center gap-3 duration-200"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="text-primary h-5 w-5 shrink-0 animate-spin" />
      <div className="text-foreground text-base font-semibold">{message}</div>
    </div>
  );
}
