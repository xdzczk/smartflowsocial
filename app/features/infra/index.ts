/**
 * Infrastructure Feature Public API
 * 
 * This module exports the public API for infrastructure-related operations.
 * Internal implementation details are kept in services/ directory.
 * 
 * Usage:
 *   import { performHealthCheck } from "~/features/infra";
 * 
 * Do NOT import from internal paths like:
 *   import { ... } from "~/features/infra/services/..."  // ❌ Bad
 */

// ============================================================================
// Health Check
// ============================================================================

export {
  performHealthCheck,
  handleHealthCheckError,
} from "./services/healthcheck.server";

