import { getGiveawayById } from "./giveaway-actions-crud.server";
import { ERROR_GIVEAWAY_NOT_FOUND } from "./giveaway-actions-shared.server";
import { appendGiveawayActivityLog } from "./giveaway-activity-log.server";
import { updateGiveaway as updateGiveawayRow } from "./repositories/giveaway-actions-data.server";

export async function appendGiveawayAuditActivity(
  userId: string,
  giveawayId: string,
  type: "csv_exported" | "proof_summary_copied"
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  await updateGiveawayRow(giveawayId, {
    activityLog: appendGiveawayActivityLog(g.activityLog, type, {}),
  });
  return { success: true };
}
