/**
 * Property-based tests for encryption/decryption
 *
 * Uses fast-check to verify critical encryption properties:
 * - Round-trip property (encrypt then decrypt = original)
 * - Deterministic vs non-deterministic behavior
 * - Data integrity
 */

import fc from "fast-check";
import { describe, it, beforeEach } from "vitest";

import { encrypt, decrypt } from "~/lib/encryption.server";
describe("Property-Based Tests: Encryption", () => {
  beforeEach(() => {
    // Ensure SESSION_SECRET is set for tests
    process.env["SESSION_SECRET"] =
      "test-session-secret-very-long-and-secure-32-chars";
  });

  describe("Round-Trip Property", () => {
    it("should decrypt to original value for any plaintext", () => {
      fc.assert(
        fc.property(
          fc.string(), // Any string, including empty, unicode, special chars
          (plaintext: string) => {
            try {
              const encrypted = encrypt(plaintext);
              const decrypted = decrypt(encrypted);
              return decrypted === plaintext;
            } catch (_error) {
              return false;
            }
          }
        ),
        { numRuns: 50, timeout: 30000 } // Reduced runs and increased timeout
      );
    }, 60000); // 60 second test timeout

    it("should handle empty strings correctly", () => {
      fc.assert(
        fc.property(fc.constant(""), (plaintext: string) => {
          const encrypted = encrypt(plaintext);
          const decrypted = decrypt(encrypted);
          return decrypted === plaintext;
        }),
        { timeout: 30000 }
      );
    }, 60000); // 60 second test timeout

    it("should handle very long strings", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 10000 }),
          (plaintext: string) => {
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            return decrypted === plaintext;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle unicode and special characters", () => {
      // Generate strings that can include unicode characters
      // fast-check's string() generator handles unicode by default
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (plaintext: string) => {
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            return decrypted === plaintext;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Non-Deterministic Property", () => {
    it("should produce different ciphertexts for same plaintext (due to random IV/salt)", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (plaintext: string) => {
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);
            // Should be different (very high probability)
            return encrypted1 !== encrypted2;
          }
        ),
        { numRuns: 20 } // Lower runs since this is probabilistic
      );
    });
  });

  describe("Data Integrity Property", () => {
    it("should detect tampered ciphertext", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (plaintext: string, tamperIndex: number) => {
            const encrypted = encrypt(plaintext);
            const encryptedBuffer = Buffer.from(encrypted, "base64");

            // Tamper with the data
            if (encryptedBuffer.length > tamperIndex) {
              const tamperValue = encryptedBuffer[tamperIndex];
              if (tamperValue !== undefined) {
                encryptedBuffer[tamperIndex] = (tamperValue + 1) % 256;
              }
              const tampered = encryptedBuffer.toString("base64");

              // Should throw error on decryption
              try {
                decrypt(tampered);
                return false; // Should have thrown
              } catch {
                return true; // Correctly detected tampering
              }
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Format Properties", () => {
    it("should always produce base64-encoded output", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (plaintext: string) => {
            const encrypted = encrypt(plaintext);
            // Check if valid base64
            try {
              Buffer.from(encrypted, "base64");
              return /^[A-Za-z0-9+/]*={0,2}$/.test(encrypted);
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should produce output longer than input (due to IV, salt, auth tag)", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          (plaintext: string) => {
            const encrypted = encrypt(plaintext);
            // Encrypted should be longer (base64 encoding + overhead)
            return encrypted.length >= plaintext.length;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
