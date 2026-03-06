import { Link, useLoaderData } from "@remix-run/react";

function scopeSummary(scopeType: string): string {
  switch (scopeType) {
    case "PERIOD":
      return "Period";
    case "SINGLE_POST":
      return "Single post";
    case "QUEUE":
      return "Queue";
    default:
      return scopeType;
  }
}

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "DRAFT":
      return "secondary";
    case "PREVIEWED":
      return "outline";
    case "LOCKED":
      return "default";
    case "PAID_OUT":
      return "secondary";
    case "CANCELLED":
      return "destructive";
    default:
      return "secondary";
  }
}

export default function GiveawayPage() {
  const { giveaways } = useLoaderData<{
    giveaways: Array<{
      id: string;
      status: string;
      scopeType: string;
      winnerCount: number;
      createdAt: string;
    }>;
  }>();

  return (
    <div className="space-y-6">
      <div className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground font-semibold">Your giveaways</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a giveaway, preview winners, then lock and pay out.
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Create → Preview winners → Lock → Zap and mark paid out
          </p>
        </div>
        <Link
          to="/dashboard/giveaway/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          New giveaway
        </Link>
      </div>

      {giveaways.length > 0 ? (
        <ul className="border-border bg-card divide-border divide-y rounded-lg border">
          {giveaways.map((g) => (
            <li key={g.id}>
              <Link
                to={`/dashboard/giveaway/detail/${g.id}`}
                className="hover:bg-muted/50 flex flex-col gap-2 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusVariant(g.status) === "destructive"
                          ? "bg-destructive/10 text-destructive"
                          : statusVariant(g.status) === "outline"
                            ? "bg-muted text-muted-foreground"
                            : statusVariant(g.status) === "default"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {g.status.replace("_", " ")}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {scopeSummary(g.scopeType)} · {g.winnerCount} winner
                      {g.winnerCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    Created {new Date(g.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-primary text-sm font-medium">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-foreground font-medium">No giveaways yet</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Create your first giveaway to pick winners from your post
            engagement. You’ll set the scope, preview winners, then lock and pay
            out.
          </p>
          <Link
            to="/dashboard/giveaway/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            New giveaway
          </Link>
        </div>
      )}
    </div>
  );
}
