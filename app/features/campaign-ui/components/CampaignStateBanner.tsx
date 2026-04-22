export function CampaignStateBanner({
  title,
  tone,
}: {
  title: string;
  tone: "neutral" | "blue" | "amber" | "green" | "muted";
}) {
  const toneClass: Record<
    "neutral" | "blue" | "amber" | "green" | "muted",
    string
  > = {
    neutral: "border-border bg-surface-hover/40 text-text",
    blue: "border-info/40 bg-info/10 text-text",
    amber: "border-warning/50 bg-warning/10 text-text",
    green: "border-success/50 bg-success/10 text-text",
    muted: "border-border bg-surface-hover/30 text-text-secondary",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      <p className="font-medium">{title}</p>
    </div>
  );
}
