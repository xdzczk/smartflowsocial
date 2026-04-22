import { cn } from "~/lib/utils";

export function RewardSummaryLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-text-secondary text-sm leading-snug tabular-nums",
        className
      )}
    >
      {children}
    </p>
  );
}
