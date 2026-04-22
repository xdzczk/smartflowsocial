import { cn } from "~/lib/utils";

export interface DestructiveSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pattern E — cancel subscription, dangerous resets. Keep visually separated from neutral controls.
 */
export function DestructiveSection({
  title,
  description,
  children,
  className,
}: DestructiveSectionProps) {
  return (
    <section
      className={cn(
        "border-danger/50 bg-danger/5 rounded-lg border px-4 py-4 sm:px-5 sm:py-5",
        className
      )}
    >
      <h2 className="text-danger text-base font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-text-secondary mt-2 text-sm leading-relaxed">
        {description}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
