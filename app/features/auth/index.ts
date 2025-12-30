/**
 * Auth Feature Public API
 * 
 * This module exports the public API for authentication-related operations.
 * Internal implementation details are kept in components/ directory.
 * 
 * Usage:
 *   import { getUser, requireUserId } from "~/features/auth";
 * 
 * Do NOT import from internal paths like:
 *   import { ... } from "./components/..."  // ❌ Bad
 */

// ============================================================================
// Session Management
// ============================================================================

export {
  getUser,
  getUserId,
  requireUserId,
  requireUser,
  logout,
  createUserSession,
} from "./session.server";

// ============================================================================
// User Profile
// ============================================================================

export {
  updateUserProfile,
} from "~/features/user";

// ============================================================================
// Nostr Authentication
// ============================================================================

export { authenticateNostrUser } from "./services/nostr-auth.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { default as NostrAuthButton } from "./components/NostrAuthButton";
