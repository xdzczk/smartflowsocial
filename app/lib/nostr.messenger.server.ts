/* eslint-env node */

import { nip04, finalizeEvent } from "nostr-tools";

import { logWarning, logError } from "~/lib/error-logger.server";

import { convertToHex } from "./nostr-conversion";
import { relaysArray } from "./relays";

interface SendNostrDirectMessageResult {
  success: boolean;
  event?: any;
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
    const nsecHex: string | null = convertToHex(process.env.NOSTR_NSEC);

    if (!nsecHex) {
      return {
        success: false,
        error: "NOSTR_NSEC is not set or could not be converted to hex.",
      };
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
    const signedEvent = finalizeEvent(eventTemplate, nsecHex);

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
  } catch (error: any) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      receiverPubkey,
      message: "Error sending Nostr direct message",
    });
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}
