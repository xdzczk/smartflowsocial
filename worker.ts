import { webcrypto as nodeWebcrypto } from "node:crypto";
// Ensure Web Crypto API exists for server-side code that expects browser crypto
if (!(globalThis as any).crypto?.getRandomValues) {
  (globalThis as any).crypto = nodeWebcrypto as any;
}

// Import and initialize the queue workers
import {
  scheduledPostsWorker,
  postCheckerWorker,
} from "./app/features/posts/queues.server";

console.log("🚀 BullMQ worker started");
console.log("Workers initialized:", {
  scheduledPostsWorker: !!scheduledPostsWorker,
  postCheckerWorker: !!postCheckerWorker,
});

// Keep the process alive
process.on("SIGTERM", async () => {
  console.log("Worker shutting down...");
  await scheduledPostsWorker.close();
  await postCheckerWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Worker shutting down...");
  await scheduledPostsWorker.close();
  await postCheckerWorker.close();
  process.exit(0);
});
