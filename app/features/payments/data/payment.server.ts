import { env } from "~/lib/env.server";

// Polyfill WebSocket for @getalby/sdk in Node.js (production only)
// Must run when payment code loads.
if (
  env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime polyfill check for Node.js environment
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

export * from "./payment-shared.server";
export * from "./payment.queries.server";
export * from "./payment.commands.server";
export * from "./payment.handlers.server";
