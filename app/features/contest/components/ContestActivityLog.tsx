import { contestCopy } from "../contest-copy";

export function ContestActivityLog({
  events,
}: {
  events: Array<{
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
  }>;
}) {
  if (events.length === 0) return null;
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">{contestCopy.activityLog}</h2>
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
        {events.map((e) => (
          <li
            key={e.id}
            className="border-border flex gap-2 border-b pb-2 last:border-0"
          >
            <span className="text-muted-foreground shrink-0 text-xs">
              {new Date(e.createdAt).toLocaleString()}
            </span>
            <span>
              <span className="text-muted-foreground font-mono text-xs">
                {e.eventType}
              </span>{" "}
              — {e.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
