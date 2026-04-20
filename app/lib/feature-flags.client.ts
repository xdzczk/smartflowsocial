/**
 * Client-side feature flags.
 *
 * These are evaluated at bundle time via `process.env` (Remix replaces
 * `process.env.FOO` literals statically for the browser bundle). Use this
 * module for behavior toggles that must take effect in client code paths.
 *
 * Server-only flags continue to live in `~/lib/feature-flags.server`.
 *
 * Tests can override individual flags via {@link _setClientFeatureFlagsForTests}
 * — production code paths must read the named export directly so the
 * literal is statically replaced and dead branches drop out of the bundle.
 */

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
 * Mutable on purpose so tests can flip individual flags via
 * {@link _setClientFeatureFlagsForTests} without rebuilding the bundle.
 * Production code should read these as plain boolean values.
 */
export const clientFeatureFlags: { signingMultiSlot: boolean } = {
  /**
   * When true, the signing-attempts store keeps multiple in-flight
   * attempts (capped at MAX_ATTEMPTS) keyed by attemptId, with LRU
   * non-foreground eviction. When false (default), every `start()`
   * cancels any prior attempt — preserving the pre-PR-2 single-slot
   * behavior the composer was built around.
   *
   * Default OFF for one release. PR 6 of the unified-signing-recovery
   * plan flips this in production after telemetry confirms multi-slot
   * mode is regression-free.
   */
  signingMultiSlot: parseBooleanEnv(process.env["SIGNING_MULTI_SLOT"], false),
};

/**
 * Test-only override. Production code MUST NOT call this — flags should
 * be set via env vars at build/deploy time so dead branches can be
 * eliminated by the bundler.
 */
export function _setClientFeatureFlagsForTests(
  overrides: Partial<typeof clientFeatureFlags>
): void {
  Object.assign(clientFeatureFlags, overrides);
}
