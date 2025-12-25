/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from ~/features/user instead.
 * 
 * This file re-exports all functions from the new feature-based structure.
 * 
 * Migration path:
 * - Old: import { getUserById } from "~/models/user.server"
 * - New: import { getUserById } from "~/features/user"
 */

// Re-export everything from the new feature structure
export * from "~/features/user";
