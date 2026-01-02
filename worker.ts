import { webcrypto as nodeWebcrypto } from "node:crypto";
// Ensure Web Crypto API exists for server-side code that expects browser crypto
if (!((globalThis as { crypto?: Crypto }).crypto?.getRandomValues)) {
  ((globalThis as { crypto: Crypto })).crypto = nodeWebcrypto as Crypto;
}

// Import and initialize the queue workers
import {
  scheduledPostsWorker,
  postCheckerWorker,
} from "./app/features/posts/queues.server";

// Import centralized environment validation
// This validates env vars at module load time and exports typed config
import "./app/lib/env.server";

console.log("🚀 BullMQ worker started");
console.log("Workers initialized:", {
  scheduledPostsWorker: !!scheduledPostsWorker,
  postCheckerWorker: !!postCheckerWorker,
});

// Keep the process alive
process.on("SIGTERM", () => {
  console.log("Worker shutting down...");
  void scheduledPostsWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Worker shutting down...");
  void scheduledPostsWorker.close();
  void postCheckerWorker.close();
  process.exit(0);
});
