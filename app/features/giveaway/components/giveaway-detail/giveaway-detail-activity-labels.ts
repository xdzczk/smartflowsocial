export function formatActivityTypeLabel(type: string): string {
  const map: Record<string, string> = {
    giveaway_created: "Giveaway created",
    configuration_updated: "Giveaway edited",
    preview_generated: "Preview generated",
    rerolled: "Reroll executed",
    winner_excluded: "Winner excluded",
    fee_quoted: "Finalization fee quoted",
    fee_paid: "Finalization fee paid",
    giveaway_locked: "Winners locked",
    locked: "Winners locked",
    csv_exported: "CSV exported",
    proof_summary_copied: "Proof summary copied",
    completed: "Giveaway completed",
    cancelled: "Giveaway cancelled",
    reset_to_draft: "Reset to draft",
  };
  return map[type] ?? type.replace(/_/g, " ");
}
