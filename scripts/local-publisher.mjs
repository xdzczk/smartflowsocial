/**
 * Signature-checking HTTP publisher for local development and the self-host smoke.
 * It is not the Cloudflare publisher. It does not open relay sockets.
 *
 * Start: pnpm dev:publisher
 * Then set NOSTR_PUBLISHER_URL=http://127.0.0.1:8787/publish
 * and NOSTR_PUBLISHER_API_TOKEN to the same value as LOCAL_PUBLISHER_TOKEN.
 */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

import { verifyEvent } from "nostr-tools";

const MAX_BODY_BYTES = 256 * 1024;

function tokensMatch(provided, expected) {
  const left = typeof provided === "string" ? provided.trim() : "";
  const right = typeof expected === "string" ? expected.trim() : "";
  if (right.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

/**
 * @param {{ token?: string, allowUnauthenticated?: boolean, port?: number }} options
 */
export function createLocalPublisher(options = {}) {
  const token = options.token?.trim() ?? "";
  const allowUnauthenticated = options.allowUnauthenticated === true;
  /** @type {Array<{ relays: string[], event: Record<string, unknown> }>} */
  const received = [];

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        mode: "local-signature-check",
        relays: false,
      });
      return;
    }

    if (url.pathname !== "/publish") {
      sendJson(response, 404, { message: "not found" });
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { message: "method not allowed" });
      return;
    }

    if (
      !allowUnauthenticated &&
      !tokensMatch(request.headers["api-token"], token)
    ) {
      sendJson(response, 401, { message: "unauthorized" });
      return;
    }

    let raw = "";
    try {
      raw = await readBody(request);
    } catch {
      sendJson(response, 413, { message: "body too large" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(response, 400, { message: "invalid json" });
      return;
    }

    const event = parsed?.event;
    const relays = Array.isArray(parsed?.relays)
      ? parsed.relays.filter(
          (relay) => typeof relay === "string" && relay.trim()
        )
      : [];
    if (!event || typeof event !== "object") {
      sendJson(response, 400, { message: "missing event" });
      return;
    }

    let valid = false;
    try {
      valid = verifyEvent(event);
    } catch {
      valid = false;
    }
    if (!valid) {
      sendJson(response, 400, { message: "invalid event signature" });
      return;
    }

    received.push({ relays, event });
    sendJson(response, 200, {
      results: relays.map((relay) => ({
        relay,
        ok: true,
        latencyMs: 1,
      })),
    });
  });

  return {
    server,
    received,
    listen(port = options.port ?? 0, host = "127.0.0.1") {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          const address = server.address();
          if (address == null || typeof address === "string") {
            reject(new Error("publisher did not bind a TCP port"));
            return;
          }
          resolve(address.port);
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

function startFromCli() {
  const token = process.env.LOCAL_PUBLISHER_TOKEN?.trim() ?? "";
  const allowUnauthenticated =
    process.env.LOCAL_PUBLISHER_ALLOW_UNAUTHENTICATED === "true";
  if (!token && !allowUnauthenticated) {
    process.stderr.write(
      "Set LOCAL_PUBLISHER_TOKEN, or LOCAL_PUBLISHER_ALLOW_UNAUTHENTICATED=true for a private machine.\n"
    );
    process.exit(1);
  }
  const port = Number(process.env.LOCAL_PUBLISHER_PORT ?? 8787);
  const publisher = createLocalPublisher({
    token,
    allowUnauthenticated,
    port,
  });
  publisher
    .listen(port)
    .then((bound) => {
      process.stdout.write(
        `Local publisher on http://127.0.0.1:${bound}/publish (signature check only, no relays)\n`
      );
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exit(1);
    });
}

if (isDirectRun()) {
  startFromCli();
}
