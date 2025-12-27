/**
 * Settings action handlers
 * Centralized router for all settings-related actions
 * 
 * Individual action handlers are split by domain in the actions/ directory
 */

import { json } from "@remix-run/node";

import { handleAccountsAction } from "./actions/accounts-actions.server";
import { handleEngagementAction } from "./actions/engagement-actions.server";
import { handleGeneralSettingsAction } from "./actions/general-settings-actions.server";
import { handleHashtagPresetAction } from "./actions/hashtag-presets-actions.server";
import { handleNWCAction } from "./actions/nwc-actions.server";
import { handleQueueTypeAction } from "./actions/queue-types-actions.server";
import { handleStorageSettingsAction } from "./actions/storage-settings-actions.server";
import { handleSubscriptionAction } from "./actions/subscription-actions.server";
/**
 * Main settings action handler
 * Routes actions to appropriate handlers
 */
export async function handleSettingsAction(
  userId: string,
  formData: FormData,
) {
  const _action = formData.get("_action") as string;

  if (!_action) {
    return json({ error: "Action is required" }, { status: 400 });
  }

  // Try each handler category
  const handlers = [
    handleHashtagPresetAction,
    handleGeneralSettingsAction,
    handleQueueTypeAction,
    handleStorageSettingsAction,
    handleNWCAction,
    handleAccountsAction,
    handleSubscriptionAction,
    handleEngagementAction,
  ];

  for (const handler of handlers) {
    const result = await handler(userId, _action, formData);
    if (result) {
      return result;
    }
  }

  return json({ error: "Invalid action type" }, { status: 400 });
}

