/**
 * CSRF Protection Middleware - Server Re-export
 *
 * This file re-exports from csrf.ts to maintain backward compatibility.
 * Routes should import from "~/lib/csrf" instead of this file.
 *
 * @deprecated Use "~/lib/csrf" instead
 */

// Re-export from the unified implementation
export { withCSRFProtection } from "./csrf";


