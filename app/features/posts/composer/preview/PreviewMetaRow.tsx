import { cn } from "~/lib/utils";

export function PreviewMetaRow({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  const filtered = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (filtered.length === 0) return null;
  return (
    <div
      className={cn(
        "text-muted-foreground/80 border-border/40 mt-3 border-t pt-3 text-[11px] leading-relaxed",
        className
      )}
    >
      {filtered.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
