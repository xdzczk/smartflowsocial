/**
 * Nostr Feature Public API
 * 
 * This module exports the public API for Nostr-related types and utilities.
 * 
 * Usage:
 *   import type { NostrEvent, NostrProfile } from "~/features/nostr";
 * 
 * Do NOT import from internal paths:
 *   import { ... } from "~/features/nostr/types"  // ❌ Bad - use this module instead
 */

// ============================================================================
// Types
// ============================================================================

export type {
  NostrEvent,
  NostrProfileType,
  ProfileData,
  RelaysSettingsProps,
} from "./types";

