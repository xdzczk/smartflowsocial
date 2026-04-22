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
        "motion-fast inline-flex h-7 min-w-0 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-medium",
        selected
          ? "border-brand bg-brand text-brand-on hover:bg-brand/90"
          : "border-border bg-canvas text-text hover:bg-surface-hover/60",
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
