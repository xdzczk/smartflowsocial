import { env } from "~/lib/env.server";

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return defaultValue;
  return ["1", "true", "yes", "y", "on", "enabled"].includes(normalized);
}

/**
 * Feature flags used for staged rollouts / emergency toggles.
 *
 * These default to secure behavior (enabled) unless explicitly disabled.
 */
export const featureFlags = {
  /**
   * Enables the server-issued challenge / verify auth flow:
   * - POST /auth/nostr/challenge
   * - POST /auth/nostr/verify
   */
  nostrAuthV2Enabled: parseBooleanEnv(env.NOSTR_AUTH_V2_ENABLED, true),

  /**
   * Enforces the invariant that every signed event pubkey matches the active
   * authenticated session pubkey.
   */
  enforceNostrSessionPubkey: parseBooleanEnv(
    env.ENFORCE_NOSTR_SESSION_PUBKEY,
    true
  ),

  /**
   * Enables unified media ingest pipeline (`/api/media/intents` + `/api/media/commit`).
   */
  mediaPipelineV2Enabled: parseBooleanEnv(env.MEDIA_PIPELINE_V2_ENABLED, true),

  /**
   * Enables outbox-driven Nostr delete requests (kind:5).
   */
  nostrDeleteEventsEnabled: parseBooleanEnv(
    env.ENABLE_NOSTR_DELETE_EVENTS,
    false
  ),

  /**
   * When enabled, server-sent DMs attempt NIP-17 (gift wrap) when the recipient
   * publishes kind:10050 inbox relays. NIP-04 is always attempted afterward for legacy clients.
   */
  nostrDmNip17Enabled: parseBooleanEnv(env.NOSTR_DM_NIP17_ENABLED, true),

  /**
   * NIP-88 polls: kind 1068 compose/schedule, kind 1018 vote publish, in-app tallies.
   */
  nip88PollsEnabled: parseBooleanEnv(env.NIP88_POLLS_ENABLED, false),

  /**
   * Contests v1 ranked campaigns.
   */
  contestsV1Enabled: parseBooleanEnv(env.CONTESTS_V1_ENABLED, true),

  /**
   * Dual-lane subscription checkout (auto-renew + one-time).
   */
  subscriptionCheckoutV2Enabled: parseBooleanEnv(
    env.SUBSCRIPTION_CHECKOUT_V2_ENABLED,
    true
  ),
} as const;
