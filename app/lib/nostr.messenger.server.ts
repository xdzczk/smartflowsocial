/* eslint-env node */

import { nip04, finalizeEvent, nip19 } from "nostr-tools";

import { logWarning, logError } from "~/lib/error-logger.server";

import { convertToHex } from "./nostr-conversion";
import { relaysArray } from "./relays";

interface SendNostrDirectMessageResult {
  success: boolean;
  event?: unknown;
  status?: number;
  error?: string;
}

export async function sendNostrDirectMessage(
  receiverPubkey: string,
  content: string,
): Promise<SendNostrDirectMessageResult | false> {
  try {
    if (!content) {
      return false;
    }
    const nsecEnv = process.env.NOSTR_NSEC;
    if (!nsecEnv) {
      return {
        success: false,
        error: "NOSTR_NSEC is not set.",
      };
    }
    const nsecHex: string | null = convertToHex(nsecEnv);

    if (!nsecHex) {
      return {
        success: false,
        error: "NOSTR_NSEC could not be converted to hex.",
      };
    }

    // Convert hex string to Uint8Array for finalizeEvent
    let privateKeyBytes: Uint8Array;
    try {
      if (nsecEnv.startsWith("nsec")) {
        const decoded = nip19.decode(nsecEnv);
        if (decoded.type === "nsec") {
          privateKeyBytes = decoded.data;
        } else {
          throw new Error("Invalid nsec format");
        }
      } else {
        // Assume hex string
        privateKeyBytes = new Uint8Array(
          nsecHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
        );
      }
    } catch {
      // Fallback: treat as hex string
      privateKeyBytes = new Uint8Array(
        nsecHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
    }

    // Ensure receiver pubkey is hex. Convert if an npub/bech32 is provided.
    let receiverHex: string = receiverPubkey;
    try {
      if (
        typeof receiverPubkey === "string" &&
        receiverPubkey.startsWith("npub")
      ) {
        const converted = convertToHex(receiverPubkey);
        if (converted) receiverHex = converted;
      }
    } catch (e) {
      logWarning("Failed to convert receiver pubkey to hex; using original value", {
        receiverPubkey,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Encrypt the content
    const encryptedContent: string = nip04.encrypt(
      nsecHex,
      receiverHex,
      content,
    );

    // Create event template
    const eventTemplate = {
      kind: 4, // NIP-04 encrypted direct message
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["p", receiverHex], // Recipient's pubkey
      ],
      content: encryptedContent,
    };

    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

    // Send the event to the publisher
    const publisherUrl = process.env.NOSTR_PUBLISHER_URL;
    if (!publisherUrl) {
      return {
        success: false,
        error: "NOSTR_PUBLISHER_URL is not set.",
        event: signedEvent,
      };
    }

    const response = await fetch(publisherUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relays: relaysArray,
        event: signedEvent,
      }),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (err) {
        // ignore
      }
      return {
        success: false,
        status: response.status,
        error: errorText,
        event: signedEvent,
      };
    }

    return { success: true, event: signedEvent };
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      receiverPubkey,
      message: "Error sending Nostr direct message",
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
