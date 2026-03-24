export interface CampaignActivityLogItem {
  id: string;
  at: string;
  type: string;
  message: string;
}

export function CampaignActivityLogShell({
  title,
  items,
}: {
  title: string;
  items: CampaignActivityLogItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-border flex gap-2 border-b pb-2 last:border-0"
          >
            <span className="text-muted-foreground shrink-0 text-xs">
              {new Date(item.at).toLocaleString()}
            </span>
            <span>
              <span className="text-muted-foreground font-mono text-xs">
                {item.type}
              </span>{" "}
              — {item.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
