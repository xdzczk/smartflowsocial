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
  scheduledLongFormPostsWorker,
  postCheckerWorker,
  broadcastDmWorker,
} from "./app/features/posts/queues.server";

// Import outbox worker
import { startOutboxWorker } from "./app/infra/outbox/outbox-worker.server";
import { getQueueInstance } from "./app/infra/queue";
import { runRunwayLowNotifications } from "./app/features/posts/runway/runway-low-notifications.server";
import { checkAndRenewSubscriptions } from "./app/features/payments/services/subscription-renewal.server";
import {
  expireBlossomReservations,
  getBlossomReservationDriftStats,
} from "./app/features/upload";

// Import centralized environment validation
// This validates env vars at module load time and exports typed config
import { env } from "./app/lib/env.server";
import { logInfo, logWarning } from "./app/lib/error-logger.server";
import { updateRelayMetrics } from "./app/lib/metrics/relay-metrics.server";
import {
  setQueueOldestWaitingAgeSeconds,
  setQueueStatusDepth,
} from "./app/lib/queue-metrics.server";

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

const queueBacklogMetricsIntervalMs = 10_000;
const queueBacklogMetricsInterval = setInterval(() => {
  void (async () => {
    try {
      const queueNames = [
        "scheduled-posts",
        "scheduled-longform-posts",
        "post-checker",
        "broadcast-dm",
      ] as const;
      for (const queueName of queueNames) {
        const queue = getQueueInstance(queueName);
        const counts = await queue.getJobCounts(
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
          "paused"
        );
        const statuses: Record<string, number> = {
          waiting: counts["waiting"] ?? 0,
          active: counts["active"] ?? 0,
          completed: counts["completed"] ?? 0,
          failed: counts["failed"] ?? 0,
          delayed: counts["delayed"] ?? 0,
          paused: counts["paused"] ?? 0,
        };
        for (const [status, count] of Object.entries(statuses)) {
          setQueueStatusDepth(queueName, status, count);
        }

        const [oldestWaitingJob] = await queue.getJobs(["waiting"], 0, 0, true);
        const [oldestDelayedJob] = await queue.getJobs(["delayed"], 0, 0, true);
        const candidateTimestamps = [oldestWaitingJob, oldestDelayedJob]
          .map((job) =>
            job && typeof job.timestamp === "number" ? job.timestamp : null
          )
          .filter((timestamp): timestamp is number => timestamp !== null);
        if (candidateTimestamps.length === 0) {
          setQueueOldestWaitingAgeSeconds(queueName, 0);
        } else {
          const oldestTimestamp = Math.min(...candidateTimestamps);
          setQueueOldestWaitingAgeSeconds(
            queueName,
            (Date.now() - oldestTimestamp) / 1000
          );
        }
      }
    } catch {
      // Best-effort metrics collection.
    }
  })();
}, queueBacklogMetricsIntervalMs);

const blossomReservationCleanupIntervalMs = 60_000;
const blossomReservationCleanupInterval = setInterval(() => {
  void (async () => {
    try {
      const expired = await expireBlossomReservations();
      const drift = await getBlossomReservationDriftStats();
      logInfo("Blossom reservation maintenance", {
        ...expired,
        reservedCount: drift.reservedCount,
        activeBatchCount: drift.activeBatchCount,
        oldestReservedCreatedAt: drift.oldestReservedCreatedAt?.toISOString(),
      });
    } catch {
      // Best-effort; reservation cleanup should never crash the worker.
    }
  })();
}, blossomReservationCleanupIntervalMs);

// Periodically send "runway low" push notifications to opted-in users.
// Per-user 24h throttle lives in the notification service, so running this more
// often than daily is safe and just makes notifications more timely.
const runwayLowIntervalMinutes = parseInt(
  env.RUNWAY_LOW_CRON_INTERVAL_MINUTES ?? "60",
  10
);
let runwayLowInterval: ReturnType<typeof setInterval> | null = null;
const runRunwayLowSweep = () => {
  void (async () => {
    try {
      const result = await runRunwayLowNotifications();
      logInfo("Runway-low sweep completed", { ...result });
    } catch (error) {
      logWarning("Runway-low sweep failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};
if (Number.isFinite(runwayLowIntervalMinutes) && runwayLowIntervalMinutes > 0) {
  const runwayLowIntervalMs = runwayLowIntervalMinutes * 60_000;
  // Delay the first run so the worker finishes booting (queues, DB pool) first.
  const runwayLowStartupDelay = setTimeout(runRunwayLowSweep, 60_000);
  runwayLowStartupDelay.unref?.();
  runwayLowInterval = setInterval(runRunwayLowSweep, runwayLowIntervalMs);
  logInfo("Runway-low scheduler started", {
    intervalMinutes: runwayLowIntervalMinutes,
  });
} else {
  logInfo("Runway-low scheduler disabled (RUNWAY_LOW_CRON_INTERVAL_MINUTES=0)");
}

const subscriptionRenewalIntervalMinutes = parseInt(
  env.SUBSCRIPTION_RENEWAL_INTERVAL_MINUTES ?? "60",
  10
);
let subscriptionRenewalInterval: ReturnType<typeof setInterval> | null = null;
let subscriptionRenewalInFlight = false;
const runSubscriptionRenewalSweep = () => {
  if (subscriptionRenewalInFlight) return;
  subscriptionRenewalInFlight = true;
  void (async () => {
    try {
      const result = await checkAndRenewSubscriptions();
      logInfo("Subscription renewal sweep completed", {
        checked: result.checked,
        expired: result.expired,
        renewalAttempted: result.renewalAttempted,
        renewalSuccess: result.renewalSuccess,
        renewalFailed: result.renewalFailed,
        disabled: result.disabled,
        success: result.success,
      });
    } catch (error) {
      logWarning("Subscription renewal sweep failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      subscriptionRenewalInFlight = false;
    }
  })();
};
if (
  Number.isFinite(subscriptionRenewalIntervalMinutes) &&
  subscriptionRenewalIntervalMinutes > 0
) {
  const subscriptionRenewalIntervalMs =
    subscriptionRenewalIntervalMinutes * 60_000;
  const subscriptionRenewalStartupDelay = setTimeout(
    runSubscriptionRenewalSweep,
    90_000
  );
  subscriptionRenewalStartupDelay.unref?.();
  subscriptionRenewalInterval = setInterval(
    runSubscriptionRenewalSweep,
    subscriptionRenewalIntervalMs
  );
  logInfo("Subscription renewal scheduler started", {
    intervalMinutes: subscriptionRenewalIntervalMinutes,
  });
} else {
  logInfo(
    "Subscription renewal scheduler disabled (SUBSCRIPTION_RENEWAL_INTERVAL_MINUTES=0)"
  );
}

logInfo("BullMQ worker started");
logInfo("Workers initialized", {
  scheduledPostsWorker: !!scheduledPostsWorker,
  scheduledLongFormPostsWorker: !!scheduledLongFormPostsWorker,
  postCheckerWorker: !!postCheckerWorker,
  broadcastDmWorker: !!broadcastDmWorker,
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
  if (runwayLowInterval) {
    clearInterval(runwayLowInterval);
  }
  if (subscriptionRenewalInterval) {
    clearInterval(subscriptionRenewalInterval);
  }
  clearInterval(relayMetricsInterval);
  clearInterval(queueBacklogMetricsInterval);
  clearInterval(blossomReservationCleanupInterval);
  workerMetricsServer.close();
  void scheduledPostsWorker.close();
  void scheduledLongFormPostsWorker.close();
  void broadcastDmWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  logInfo("Worker shutting down...");
  if (outboxWorkerInterval) {
    clearInterval(outboxWorkerInterval);
  }
  if (runwayLowInterval) {
    clearInterval(runwayLowInterval);
  }
  if (subscriptionRenewalInterval) {
    clearInterval(subscriptionRenewalInterval);
  }
  clearInterval(relayMetricsInterval);
  clearInterval(queueBacklogMetricsInterval);
  clearInterval(blossomReservationCleanupInterval);
  workerMetricsServer.close();
  void scheduledPostsWorker.close();
  void scheduledLongFormPostsWorker.close();
  void broadcastDmWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});
