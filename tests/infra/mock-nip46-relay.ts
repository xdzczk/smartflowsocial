/**
 * Mock Nostr relay + NIP-46 signer for integration tests.
 * WebSocket server that implements minimal Nostr wire protocol and, for kind 24133
 * events to the mock signer pubkey, runs NIP-46 handler (decrypt request, handle
 * method, encrypt response, broadcast). Uses same crypto as nostr-tools (NIP-44).
 */

import { createRequire } from "module";

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey as getPubkeyHex,
  type EventTemplate,
  type VerifiedEvent,
} from "nostr-tools";
import { getConversationKey, encrypt, decrypt } from "nostr-tools/nip44";
import type { WebSocket as WS } from "ws";

const requireModule = createRequire(import.meta.url);
const wsModule = requireModule("ws") as {
  Server?: new (opts: { port?: number; host?: string }) => {
    address: () => { port: number } | null;
    close: (cb?: () => void) => void;
    on: (ev: string, cb: (...args: unknown[]) => void) => void;
    once: (ev: string, cb: () => void) => void;
  };
  WebSocketServer?: typeof wsModule.Server;
};
const WebSocketServerClass = wsModule.WebSocketServer ?? wsModule.Server;
if (!WebSocketServerClass) {
  throw new Error("ws package did not export Server or WebSocketServer");
}

const NOSTR_CONNECT_KIND = 24133;

/** Generate mock signer keypair (secret key 32 bytes, pubkey hex 64). */
function generateMockSignerKeypair(): {
  secretKey: Uint8Array;
  pubkeyHex: string;
} {
  const secretKey = generateSecretKey();
  const pubkeyHex = getPubkeyHex(secretKey);
  return { secretKey, pubkeyHex };
}

const MOCK_SIGNER = generateMockSignerKeypair();

/** Export for tests that need the fixed mock signer pubkey. */
export function getMockSignerPubkeyHex(): string {
  return MOCK_SIGNER.pubkeyHex;
}

/** Minimal Nostr filter match: kinds, authors, #p. */
function eventMatchesFilter(
  event: { kind: number; pubkey: string; tags: string[][] },
  filter: Record<string, unknown>
): boolean {
  const kinds = filter["kinds"];
  if (kinds && Array.isArray(kinds) && !kinds.includes(event.kind)) {
    return false;
  }
  const authors = filter["authors"];
  if (authors && Array.isArray(authors) && !authors.includes(event.pubkey)) {
    return false;
  }
  const tagP = filter["#p"];
  if (tagP && Array.isArray(tagP)) {
    const pTag = event.tags.find((t) => t[0] === "p");
    const pValue = pTag?.[1];
    if (!pValue || !tagP.includes(pValue)) return false;
  }
  return true;
}

/** Validate minimal event shape (id, kind, pubkey, content, created_at, tags). */
function validateEvent(
  event: unknown
): event is VerifiedEvent & { content: string } {
  if (!event || typeof event !== "object") return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e["kind"] === "number" &&
    typeof e["pubkey"] === "string" &&
    /^[a-f0-9]{64}$/.test(e["pubkey"]) &&
    typeof e["content"] === "string" &&
    typeof e["created_at"] === "number" &&
    Array.isArray(e["tags"])
  );
}

/** Last decrypted request received by the mock (for Phase 5 contract assertion). */
let lastDecryptedRequest: {
  id: string;
  method: string;
  params: unknown;
} | null = null;

export function getLastDecryptedRequest(): typeof lastDecryptedRequest {
  return lastDecryptedRequest;
}

function setLastDecryptedRequest(req: typeof lastDecryptedRequest): void {
  lastDecryptedRequest = req;
}

/** Handle NIP-46 request: decrypt, dispatch method, encrypt response, return response event. */
function handleNip46Request(
  event: VerifiedEvent & { content: string },
  mockSignerSecretKey: Uint8Array,
  mockSignerPubkeyHex: string
): VerifiedEvent | null {
  const pTag = event.tags.find((t) => t[0] === "p");
  const targetSignerPubkey = pTag?.[1];
  if (targetSignerPubkey !== mockSignerPubkeyHex) return null;

  const clientPubkey = event.pubkey;
  let conversationKey: Uint8Array;
  try {
    conversationKey = getConversationKey(mockSignerSecretKey, clientPubkey);
  } catch {
    return null;
  }
  let plaintext: string;
  try {
    plaintext = decrypt(event.content, conversationKey);
  } catch {
    return null;
  }
  let req: { id: string; method: string; params?: unknown };
  try {
    req = JSON.parse(plaintext) as {
      id: string;
      method: string;
      params?: unknown;
    };
  } catch {
    return null;
  }
  if (!req.id || typeof req.method !== "string") return null;

  setLastDecryptedRequest({
    id: req.id,
    method: req.method,
    params: req.params ?? [],
  });

  let result: unknown;
  let error: string | undefined;
  try {
    switch (req.method) {
      case "get_public_key":
        result = mockSignerPubkeyHex;
        break;
      case "ping":
        result = "pong";
        break;
      case "connect":
        result = "ok";
        break;
      case "sign_event": {
        const params: unknown[] = Array.isArray(req.params) ? req.params : [];
        const eventJson: unknown = params[0];
        interface SignEventPayload {
          kind: number;
          content?: string;
          tags?: unknown[];
          created_at?: number;
        }
        const parsed: unknown =
          typeof eventJson === "string"
            ? (JSON.parse(eventJson) as unknown)
            : eventJson;
        const eventObj: SignEventPayload =
          parsed != null && typeof parsed === "object" && "kind" in parsed
            ? (parsed as SignEventPayload)
            : {
                kind: 1,
                content: "",
                tags: [],
                created_at: Math.floor(Date.now() / 1000),
              };
        const template: EventTemplate = {
          kind: eventObj.kind,
          content: eventObj.content ?? "",
          tags: Array.isArray(eventObj.tags)
            ? (eventObj.tags as string[][])
            : [],
          created_at:
            typeof eventObj.created_at === "number"
              ? eventObj.created_at
              : Math.floor(Date.now() / 1000),
        };
        const signed = finalizeEvent(template, mockSignerSecretKey);
        result = JSON.stringify(signed);
        break;
      }
      default:
        error = `unknown method: ${req.method}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const responseBody = error
    ? JSON.stringify({ id: req.id, error })
    : JSON.stringify({ id: req.id, result });
  let encryptedContent: string;
  try {
    encryptedContent = encrypt(responseBody, conversationKey);
  } catch {
    return null;
  }
  const responseTemplate: EventTemplate = {
    kind: NOSTR_CONNECT_KIND,
    content: encryptedContent,
    tags: [["p", clientPubkey]],
    created_at: Math.floor(Date.now() / 1000),
  };
  const responseEvent = finalizeEvent(responseTemplate, mockSignerSecretKey);
  return responseEvent;
}

export interface MockNip46RelayHandle {
  url: string;
  stop: () => Promise<void>;
  getMockSignerPubkey: () => string;
}

export interface StartMockNip46RelayOptions {
  port?: number;
}

/**
 * Start a WebSocket server that behaves as a minimal Nostr relay and NIP-46 signer.
 * - REQ: store subscription (sub_id, filters) per connection.
 * - EVENT: validate, broadcast to matching subscriptions; if kind 24133 and p tag = mock signer, run handler and broadcast response.
 * - CLOSE: remove subscription.
 */
export function startMockNip46Relay(
  options: StartMockNip46RelayOptions = {}
): Promise<MockNip46RelayHandle> {
  const port = options.port ?? 0;
  const wss = new WebSocketServerClass!({ port, host: "127.0.0.1" });

  interface Sub {
    subId: string;
    filters: Array<Record<string, unknown>>;
  }
  const connectionSubs = new Map<WS, Sub[]>();

  function closeAllConnections(): void {
    for (const ws of connectionSubs.keys()) {
      try {
        if (ws.readyState === 1) ws.close();
      } catch {
        // ignore
      }
    }
    connectionSubs.clear();
  }

  function broadcastEvent(event: VerifiedEvent): void {
    for (const [ws, subs] of connectionSubs) {
      if (ws.readyState !== 1) continue;
      for (const sub of subs) {
        const matches = sub.filters.some((f) => eventMatchesFilter(event, f));
        if (matches) {
          ws.send(JSON.stringify(["EVENT", sub.subId, event]));
          break;
        }
      }
    }
  }

  wss.on("connection", ((ws: WS) => {
    connectionSubs.set(ws, []);

    ws.on("message", (data: Buffer | string) => {
      let raw: string;
      try {
        raw = typeof data === "string" ? data : data.toString("utf8");
      } catch {
        return;
      }
      let arr: unknown[];
      try {
        arr = JSON.parse(raw) as unknown[];
      } catch {
        return;
      }
      if (!Array.isArray(arr) || arr.length < 2) return;

      const cmd = arr[0];
      const subs = connectionSubs.get(ws);
      if (!subs) return;

      if (cmd === "REQ") {
        const subId = arr[1] as string;
        const filters = arr.slice(2) as Array<Record<string, unknown>>;
        subs.push({ subId, filters: filters.length ? filters : [{}] });
        // NIP-01: send EOSE so the client knows the relay finished registering
        // the subscription. `Nip46Signer`'s per-RPC pre-warm uses this as the
        // "REQ is open, safe to publish EVENT" signal (mirrors Ditto / nostrify
        // NConnectSigner.send).
        try {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify(["EOSE", subId]));
          }
        } catch {
          // ignore
        }
        return;
      }
      if (cmd === "CLOSE") {
        const subId = arr[1] as string;
        const idx = subs.findIndex((s) => s.subId === subId);
        if (idx !== -1) subs.splice(idx, 1);
        return;
      }
      if (cmd === "EVENT") {
        const event = arr[1];
        if (!validateEvent(event)) return;
        const responseEvent = handleNip46Request(
          event,
          MOCK_SIGNER.secretKey,
          MOCK_SIGNER.pubkeyHex
        );
        broadcastEvent(event);
        if (responseEvent) broadcastEvent(responseEvent);
      }
    });

    ws.on("close", () => {
      connectionSubs.delete(ws);
    });
  }) as (...args: unknown[]) => void);

  return new Promise((resolve, reject) => {
    const onListen = (): void => {
      const addr = wss.address();
      const portNum =
        addr && typeof addr === "object" && "port" in addr ? addr.port : port;
      const url = `ws://127.0.0.1:${portNum}`;
      resolve({
        url,
        stop: () =>
          new Promise((done) => {
            closeAllConnections();
            wss.close(done);
          }),
        getMockSignerPubkey: () => MOCK_SIGNER.pubkeyHex,
      });
    };
    if (wss.address()) {
      onListen();
    } else {
      wss.once("listening", onListen);
    }
    wss.on("error", reject);
  });
}
