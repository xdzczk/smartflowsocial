/**
 * Dashboard action handlers
 * Centralized action processing for dashboard index page
 */

import { deleteLongFormPost, deletePost } from "~/features/posts/server";
import {
  getRunwaySettings,
  updateRunwaySettings,
  updateScheduleOverviewTarget,
} from "~/features/user";
import {
  dashboardActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

export async function handleDashboardAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, dashboardActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === "delete") {
    const deletedPost = await deletePost({ id: result.data.postId, userId });
    // Return success even if post was already deleted (idempotent operation)
    return { success: true, deleted: deletedPost !== null };
  }

  if (_action === "deleteLongForm") {
    await deleteLongFormPost({ id: result.data.postId, userId });
    return { success: true };
  }

  if (_action === "bulkDelete") {
    const results = await Promise.all(
      result.data.postIds.map((id: string) => deletePost({ id, userId }))
    );
    const deletedCount = results.filter((post) => post !== null).length;
    return { success: true, deletedCount };
  }

  if (_action === "updateRunwaySettings") {
    const current = await getRunwaySettings(userId);
    await updateRunwaySettings(userId, {
      ...current,
      queueNames: result.data.queueNames,
      mode: result.data.mode,
      redThresholdDays: result.data.redThresholdDays,
      orangeThresholdDays: result.data.orangeThresholdDays,
    });
    return { success: true };
  }

  if (_action === "updateScheduleOverviewTarget") {
    await updateScheduleOverviewTarget(userId, result.data.targetPostsPerDay);
    return { success: true };
  }

  // TypeScript guarantees this is "bulkDeleteLongForm" after previous checks
  await Promise.all(
    result.data.postIds.map((id: string) => deleteLongFormPost({ id, userId }))
  );
  return { success: true };
}
