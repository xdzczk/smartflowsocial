/** Shared status pill styles for giveaway list and detail (legible in light/dark). */

export function giveawayStatusPillClass(status: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-surface-hover text-text-secondary";
    case "PREVIEWED":
      return "bg-info/15 text-info-text";
    case "LOCKED":
      return "bg-warning/15 text-warning-text";
    case "PAID_OUT":
      return "bg-success/15 text-success-text";
    case "CANCELLED":
      return "bg-danger/15 text-danger";
    default:
      return "bg-surface-hover text-text-secondary";
  }
}
