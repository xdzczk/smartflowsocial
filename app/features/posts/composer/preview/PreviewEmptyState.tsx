import { cn } from "~/lib/utils";

export function PreviewEmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground/85 border-border/40 rounded-lg border border-dashed px-4 py-8 text-center text-sm leading-relaxed",
        className
      )}
      role="status"
    >
      {message}
    </div>
  );
}
