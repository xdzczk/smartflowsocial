export function CampaignStateBanner({
  title,
  tone,
}: {
  title: string;
  tone: "neutral" | "blue" | "amber" | "orange" | "green" | "muted";
}) {
  const toneClass: Record<
    "neutral" | "blue" | "amber" | "orange" | "green" | "muted",
    string
  > = {
    neutral: "border-border bg-muted/40 text-foreground",
    blue: "border-blue-500/40 bg-blue-500/10 text-foreground",
    amber: "border-amber-500/50 bg-amber-500/10 text-foreground",
    orange: "border-orange-500/50 bg-orange-500/10 text-foreground",
    green: "border-emerald-500/50 bg-emerald-500/10 text-foreground",
    muted: "border-border bg-muted/30 text-muted-foreground",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      <p className="font-medium">{title}</p>
    </div>
  );
}
