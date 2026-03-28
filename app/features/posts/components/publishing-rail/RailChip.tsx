import { cn } from "~/lib/utils";

export function RailChip({
  selected,
  children,
  onClick,
  disabled,
  className,
  type = "button",
  ...rest
}: React.ComponentProps<"button"> & {
  selected?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-0 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-background text-foreground hover:bg-muted/50",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function RailChipGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    />
  );
}
