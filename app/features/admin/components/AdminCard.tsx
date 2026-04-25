import { cn } from "~/lib/utils";

export type AdminCardVariant = "default" | "emphasis" | "muted" | "dangerZone";

const variantClass: Record<AdminCardVariant, string> = {
  default:
    "border-transparent bg-surface/60 border shadow-1 transition-shadow hover:shadow-2",
  emphasis:
    "border-transparent bg-brand/[0.06] border shadow-1 transition-shadow hover:shadow-2",
  muted: "border-transparent bg-surface-hover/25 border shadow-1",
  dangerZone:
    "border-transparent bg-warning/[0.06] dark:bg-warning/20 border shadow-1",
};

export function AdminCard({
  variant = "default",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: AdminCardVariant;
}) {
  return (
    <div
      className={cn("rounded-xl p-4", variantClass[variant], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
