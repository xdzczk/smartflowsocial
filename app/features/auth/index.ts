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
  getSessionId,
  getSessionPubkey,
  requireUserId,
  requireUser,
  requireSession,
  logout,
  createUserSession,
} from "./session.server";

// ============================================================================
// User Profile
// ============================================================================

export { updateUserProfile } from "~/features/user";

// ============================================================================
// Nostr Login (Challenge / Verify)
// ============================================================================

export {
  issueLoginChallenge,
  getLoginChallengeForVerify,
  consumeLoginChallengeAndCreateSession,
} from "./services/nostr-auth.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { default as NostrAuthButton } from "./components/NostrAuthButton";
export { default as LoginPage } from "./components/LoginPage";
export { RemoteSignerReconnectController } from "./components/RemoteSignerReconnectController";
