import { webcrypto as nodeWebcrypto } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { config } from "dotenv";
import ipaddr from "ipaddr.js";
import * as promClient from "prom-client";

// Load environment variables from .env file (if it exists)
// This must happen before any imports that use environment variables
config({ path: resolve(process.cwd(), ".env") });

// Ensure Web Crypto API exists for server-side code that expects browser crypto
if (!(globalThis as { crypto?: Crypto }).crypto?.getRandomValues) {
  (globalThis as { crypto: Crypto }).crypto = nodeWebcrypto as Crypto;
}

// Import and initialize the queue workers
import {
  scheduledPostsWorker,
  postCheckerWorker,
} from "./app/features/posts/queues.server";

// Import outbox worker
import { startOutboxWorker } from "./app/infra/outbox/outbox-worker.server";

// Import centralized environment validation
// This validates env vars at module load time and exports typed config
import { env } from "./app/lib/env.server";
import { logInfo, logWarning } from "./app/lib/error-logger.server";
import { updateRelayMetrics } from "./app/lib/metrics/relay-metrics.server";

// Initialize Sentry (safe no-op if not configured)
import { initSentry } from "./app/lib/sentry.server";
initSentry();

// Collect default metrics (CPU, memory, process info, etc.)
promClient.collectDefaultMetrics();

// Periodically export relay health into Prometheus gauges.
// Note: relay health is updated during publish; this just syncs the latest values into the registry.
const relayMetricsIntervalMs = 10_000;
updateRelayMetrics();
const relayMetricsInterval = setInterval(() => {
  try {
    updateRelayMetrics();
  } catch {
    // Best-effort: never crash the worker because metrics export failed.
  }
}, relayMetricsIntervalMs);

logInfo("BullMQ worker started");
logInfo("Workers initialized", {
  scheduledPostsWorker: !!scheduledPostsWorker,
  postCheckerWorker: !!postCheckerWorker,
});

// Expose Prometheus metrics endpoint (separate from web server process)
const workerMetricsPort = parseInt(env.WORKER_METRICS_PORT ?? "3011", 10);
const workerMetricsServer = createServer((req, res) => {
  void (async () => {
    if (!req.url || !req.url.startsWith("/metrics")) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    // Token protection (recommended in production)
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const token =
      url.searchParams.get("token") ??
      req.headers.authorization?.replace("Bearer ", "");

    if (env.METRICS_TOKEN) {
      if (!token || token !== env.METRICS_TOKEN) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    // IP allowlist (optional)
    if (env.METRICS_ALLOWED_IPS) {
      const forwardedFor = req.headers["x-forwarded-for"];
      const clientIp =
        (typeof forwardedFor === "string"
          ? forwardedFor.split(",")[0]?.trim()
          : undefined) ??
        (typeof req.headers["x-real-ip"] === "string"
          ? req.headers["x-real-ip"]
          : undefined) ??
        req.socket.remoteAddress ??
        "";

      const allowedIps = env.METRICS_ALLOWED_IPS.split(",").map((ip) =>
        ip.trim()
      );

      let isAllowed = false;
      try {
        const clientAddr = ipaddr.process(clientIp);

        isAllowed = allowedIps.some((allowedIp) => {
          try {
            if (clientIp === allowedIp) return true;

            if (allowedIp.includes("/")) {
              const [prefix, maskStr] = allowedIp.split("/");
              if (!maskStr || !prefix) return false;
              const mask = parseInt(maskStr, 10);
              if (isNaN(mask) || mask < 0) return false;

              const prefixAddr = ipaddr.process(prefix);
              if (clientAddr.kind() !== prefixAddr.kind()) return false;

              return clientAddr.match(prefixAddr, mask);
            }

            const allowedAddr = ipaddr.process(allowedIp);
            return clientAddr.toString() === allowedAddr.toString();
          } catch {
            return false;
          }
        });
      } catch {
        isAllowed = false;
      }

      if (!isAllowed) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({ error: "Forbidden", message: "IP not allowed" })
        );
        return;
      }
    }

    if (
      !env.METRICS_TOKEN &&
      !env.METRICS_ALLOWED_IPS &&
      env.NODE_ENV === "production"
    ) {
      logWarning(
        "Worker metrics endpoint is unprotected in production. Set METRICS_TOKEN or METRICS_ALLOWED_IPS.",
        { workerMetricsPort }
      );
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", promClient.register.contentType);
    res.end(await promClient.register.metrics());
  })();
});

workerMetricsServer.listen(workerMetricsPort, "0.0.0.0", () => {
  logInfo("Worker metrics ready", { workerMetricsPort });
});

// Start outbox worker to drain events into BullMQ
const outboxWorkerInterval = startOutboxWorker();
logInfo("Outbox worker started");

// Keep the process alive
process.on("SIGTERM", () => {
  logInfo("Worker shutting down...");
  if (outboxWorkerInterval) {
    clearInterval(outboxWorkerInterval);
  }
  clearInterval(relayMetricsInterval);
  workerMetricsServer.close();
  void scheduledPostsWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  logInfo("Worker shutting down...");
  if (outboxWorkerInterval) {
    clearInterval(outboxWorkerInterval);
  }
  clearInterval(relayMetricsInterval);
  workerMetricsServer.close();
  void scheduledPostsWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});
