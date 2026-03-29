import { ActionRailNotice } from "~/components/action-rail/ActionRailNotice";

export function RailFeedbackBlock({
  variant,
  title,
  lines,
  className,
}: {
  variant: "error" | "warning";
  title: React.ReactNode;
  lines: string[];
  className?: string;
}) {
  return (
    <ActionRailNotice
      variant={variant}
      title={title}
      lines={lines}
      className={className}
    />
  );
}
