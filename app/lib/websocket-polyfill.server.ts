import { env } from "~/lib/env.server";

/**
 * @getalby/sdk talks to NWC relays over WebSocket. Node did not provide one
 * when this app started, so production installs the `ws` package on
 * `globalThis` before the first wallet call. Browsers and current Node
 * already have WebSocket.
 */
export function ensureServerWebSocket(): void {
  if (env.NODE_ENV === "development") return;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Node versions differ
  if (globalThis.WebSocket !== undefined) return;

  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}
