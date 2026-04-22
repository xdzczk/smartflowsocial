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
        "text-text-tertiary border-border-subtle rounded-lg border border-dashed px-4 py-5 text-center text-sm leading-relaxed",
        className
      )}
      role="status"
    >
      {message}
    </div>
  );
}
