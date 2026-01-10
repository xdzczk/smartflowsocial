// Type declarations for browser globals
import type { NostrEventData, SignedEvent } from "~/features/nostr/types";

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(
        event:
          | NostrEventData
          | {
              kind: number;
              content: string;
              tags: string[][];
              created_at: number;
            }
      ): Promise<SignedEvent>;
      signSchnorr?(message: string): Promise<string>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
    ENV?: {
      NODE_ENV?: string;
      [key: string]: unknown;
    };
  }
}

// Make this file a module
export {};
