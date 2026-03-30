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
        "text-muted-foreground/80 border-border/35 rounded-lg border border-dashed px-4 py-5 text-center text-sm leading-relaxed",
        className
      )}
      role="status"
    >
      {message}
    </div>
  );
}
