/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

// Ensure Window.nostr type is available globally
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(
        event:
          | {
              kind?: number;
              content: string;
              tags?: string[][];
              created_at: number;
            }
          | {
              kind: number;
              content: string;
              tags: string[][];
              created_at: number;
            }
      ): Promise<{
        id: string;
        pubkey: string;
        sig: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
      }>;
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

export {};
