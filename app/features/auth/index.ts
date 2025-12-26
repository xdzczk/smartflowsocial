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
 *   import { ... } from "~/features/auth/components/..."  // ❌ Bad
 */

// ============================================================================
// Session Management
// ============================================================================

export {
  getUser,
  requireUserId,
  logout,
  createUserSession,
} from "./session.server";

// ============================================================================
// User Profile
// ============================================================================

export {
  updateUserProfile,
} from "~/features/user";

