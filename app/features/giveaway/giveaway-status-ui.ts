/** Shared status pill styles for giveaway list and detail (legible in light/dark). */

export function giveawayStatusPillClass(status: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-muted text-muted-foreground";
    case "PREVIEWED":
      return "bg-blue-500/15 text-blue-800 dark:text-blue-200";
    case "LOCKED":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
    case "PAID_OUT":
      return "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200";
    case "CANCELLED":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}
