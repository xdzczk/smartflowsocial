/**
 * Production process supervisor for `pnpm start`.
 *
 * Runs the web server and the BullMQ worker together. If either child exits,
 * the other is stopped and this process exits non-zero, so the container
 * stops instead of staying "healthy" with a dead worker. SIGTERM/SIGINT
 * (deploy, docker stop) stop both children and exit 0.
 *
 * Tests may set NODE_ENV=test and START_PROD_COMMANDS (JSON array of
 * [command, args] pairs) to supervise stand-in processes.
 */
import { spawn } from "node:child_process";

const STOP_GRACE_MS = 10_000;

function childSpecs() {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.START_PROD_COMMANDS != null
  ) {
    return JSON.parse(process.env.START_PROD_COMMANDS);
  }
  return [
    [process.execPath, ["./build/server.js"]],
    [process.execPath, ["./build/worker.js"]],
  ];
}

const children = childSpecs().map(([command, args]) =>
  spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  })
);

let closing = false;

function signalChildren(signal) {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

function finish(code) {
  if (closing) return;
  closing = true;
  signalChildren("SIGTERM");
  const killTimer = setTimeout(() => signalChildren("SIGKILL"), STOP_GRACE_MS);
  killTimer.unref();

  const maybeExit = () => {
    const allDone = children.every(
      (child) => child.exitCode !== null || child.signalCode !== null
    );
    if (!allDone) return;
    clearTimeout(killTimer);
    process.exit(code);
  };

  for (const child of children) child.on("exit", maybeExit);
  maybeExit();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(`[start] failed to spawn ${child.spawnfile}:`, error);
    finish(1);
  });
  child.on("exit", (code, signal) => {
    if (closing) return;
    const command = [child.spawnfile, ...child.spawnargs.slice(1)].join(" ");
    console.error(
      `[start] ${command} exited (${signal ?? code}); stopping the other process`
    );
    // A clean exit is still fatal: the container must not keep serving
    // with the worker (or the server) gone.
    const failed = signal != null || code === 0 || code == null;
    finish(failed ? 1 : code);
  });
}

process.on("SIGTERM", () => finish(0));
process.on("SIGINT", () => finish(0));
