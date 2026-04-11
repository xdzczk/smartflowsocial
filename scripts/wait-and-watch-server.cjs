const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const serverPath = path.resolve(process.cwd(), "build/server.js");
const waitIntervalMs = 200;
const maxWaitMs = 120_000;
const startedAt = Date.now();

function launchWatchProcess() {
  const child = spawn(
    process.execPath,
    ["--watch-path", serverPath, "--watch", serverPath],
    { stdio: "inherit" }
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function waitForBuildOutput() {
  if (fs.existsSync(serverPath)) {
    launchWatchProcess();
    return;
  }

  if (Date.now() - startedAt > maxWaitMs) {
    console.error(
      `Timed out waiting for build output at ${serverPath} after ${maxWaitMs}ms`
    );
    process.exit(1);
  }

  setTimeout(waitForBuildOutput, waitIntervalMs);
}

waitForBuildOutput();
