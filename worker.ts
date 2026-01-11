import { webcrypto as nodeWebcrypto } from "node:crypto";
import { resolve } from "node:path";

import { config } from "dotenv";

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
import "./app/lib/env.server";

console.log("🚀 BullMQ worker started");
console.log("Workers initialized:", {
  scheduledPostsWorker: !!scheduledPostsWorker,
  postCheckerWorker: !!postCheckerWorker,
});

// Start outbox worker to drain events into BullMQ
const outboxWorkerInterval = startOutboxWorker();
console.log("📦 Outbox worker started");

// Keep the process alive
process.on("SIGTERM", () => {
  console.log("Worker shutting down...");
  if (outboxWorkerInterval) {
    clearInterval(outboxWorkerInterval);
  }
  void scheduledPostsWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Worker shutting down...");
  if (outboxWorkerInterval) {
    clearInterval(outboxWorkerInterval);
  }
  void scheduledPostsWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});
