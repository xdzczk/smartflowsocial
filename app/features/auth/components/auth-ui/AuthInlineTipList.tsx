import { cn } from "~/lib/utils";

export interface AuthInlineTipListProps {
  items: string[];
  className?: string;
  /** Visually subordinate helper copy */
  intro?: string;
}

export function AuthInlineTipList({
  items,
  className,
  intro,
}: AuthInlineTipListProps) {
  if (items.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {intro ? (
        <p className="text-text-secondary text-xs font-medium">{intro}</p>
      ) : null}
      <ul className="text-text-secondary list-disc space-y-1 pl-4 text-xs leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
