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
        "text-text-tertiary/85 bg-section/25 border-border-subtle/55 dark:bg-section/15 rounded-xl border border-dashed px-4 py-5 text-center text-sm leading-relaxed",
        className
      )}
      role="status"
    >
      {message}
    </div>
  );
}
