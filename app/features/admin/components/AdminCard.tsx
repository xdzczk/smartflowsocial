import { cn } from "~/lib/utils";

export type AdminCardVariant = "default" | "emphasis" | "muted" | "dangerZone";

const variantClass: Record<AdminCardVariant, string> = {
  default:
    "border-border bg-card/60 border shadow-sm transition-shadow hover:shadow-md",
  emphasis:
    "border-primary/25 bg-primary/[0.06] border shadow-sm transition-shadow hover:shadow-md",
  muted: "border-border/70 bg-muted/25 border shadow-sm",
  dangerZone:
    "border-amber-500/35 bg-amber-500/[0.06] dark:bg-amber-950/20 border shadow-sm",
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
