/**
 * Engagement/muted list and reply templates action handlers
 */

import {
  replyTemplateCreateAction,
  replyTemplateDeleteAction,
  replyTemplateUpdateAction,
  syncMutedListAction,
  toggleFilterMutedAction,
  toggleHideLowTrustAction,
  updateDefaultZapAmountAction,
} from "./engagement-actions-handlers.server";

export async function handleEngagementAction(
  userId: string,
  action: string,
  formData: FormData
) {
  switch (action) {
    case "sync_muted_list":
      return syncMutedListAction(userId);
    case "toggle_filter_muted":
      return toggleFilterMutedAction(userId, formData);
    case "toggle_hide_low_trust":
      return toggleHideLowTrustAction(userId, formData);
    case "reply_template_create":
      return replyTemplateCreateAction(userId, formData);
    case "reply_template_delete":
      return replyTemplateDeleteAction(userId, formData);
    case "reply_template_update":
      return replyTemplateUpdateAction(userId, formData);
    case "update_default_zap_amount":
      return updateDefaultZapAmountAction(userId, formData);
    default:
      return null;
  }
}
