/**
 * Global "signing in progress" flag so health checks (e.g. Settings poll) can skip
 * running during bulk or sequential signing. Avoids health check and sign requests
 * competing on the same NIP-46 channel and causing timeouts.
 */
let signingInProgress = false;

export function isSigningInProgress(): boolean {
  return signingInProgress;
}

export function setSigningInProgress(value: boolean): void {
  signingInProgress = value;
}
