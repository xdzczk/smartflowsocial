/**
 * Test keys for Cypress E2E tests (DO NOT use in production)
 * These are the same keys used in tests/utils/nostr-mock.ts
 *
 * nsec: Used for signing events with nostr-tools
 * npub: User-facing public key format
 * pubkey hex: Raw hex format for Nostr event fields
 */
export const TEST_NSEC =
    "nsec10des86v2v2f77vpechpnwp3f5z3r0wu2504yfrw5qa7r7g2jsdts0xa6jh";
export const TEST_NPUB =
    "npub1vf8j2cdqlufr6w5sg03ak24frk3m36cxjmnw598f3adf6vuyvwuq2meyfk";
export const TEST_PUBKEY_HEX =
    "624f2561a0ff123d3a9043e3db2aa91da3b8eb0696e6ea14e98f5a9d338463b8";
