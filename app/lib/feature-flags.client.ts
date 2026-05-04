/**
 * Client-side feature flags.
 *
 * Flags here run inside the browser bundle, so we cannot read `process.env`
 * at runtime: `process` is not a browser global and Remix only statically
 * replaces a fixed set of `process.env.<NAME>` dot-accesses (and never the
 * bracket-notation form). To plumb a server env var through to the client,
 * serialize it on `window.ENV` from the root loader and read it from there.
 *
 * Server-only flags continue to live in `~/lib/feature-flags.server`.
 *
 * Tests can override individual flags via {@link _setClientFeatureFlagsForTests}
 *  -  production code paths read the named export directly.
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
 * Read an env var that's safe in both the browser and Node. We prefer
 * `window.ENV` (populated by the Remix root loader) and fall back to
 * `process.env` only when it actually exists (e.g. SSR / Vitest).
 *
 * Critically, we avoid bare `process.env[...]` references: the browser
 * bundle has no `process` global, and Remix's static replacement only
 * applies to dot-accessed `process.env.NODE_ENV`-style identifiers. A
 * runtime `process.env[...]` lookup throws `ReferenceError: process is
 * not defined` and crashes the entire client bundle's hydration  -
 * exactly the bug that blocked the `/` login page from ever flipping out
 * of the SSR "Preparing sign-in…" placeholder.
 */
function readEnvFlag(name: string): string | undefined {
  if (typeof window !== "undefined") {
    const env = (window as unknown as { ENV?: Record<string, string> }).ENV;
    if (env && typeof env[name] === "string") return env[name];
    return undefined;
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
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
   * non-foreground eviction. When false, every `start()` cancels any
   * prior attempt  -  the legacy pre-PR-2 single-slot behavior.
   *
   * Default ON: PR 6 of the unified-signing-recovery plan flips multi-slot
   * to the production default. Set `SIGNING_MULTI_SLOT=false` in env to
   * temporarily fall back to single-slot mode without a code change.
   */
  signingMultiSlot: parseBooleanEnv(readEnvFlag("SIGNING_MULTI_SLOT"), true),
};

/**
 * Test-only override. Production code MUST NOT call this  -  flags should
 * be set via env vars at build/deploy time so dead branches can be
 * eliminated by the bundler.
 */
export function _setClientFeatureFlagsForTests(
  overrides: Partial<typeof clientFeatureFlags>
): void {
  Object.assign(clientFeatureFlags, overrides);
}
