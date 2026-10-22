import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

function runSupervisor(
  commands: Array<[string, string[]]>,
  options?: { signal?: NodeJS.Signals; signalAfterMs?: number }
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/start-prod.mjs"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        START_PROD_COMMANDS: JSON.stringify(commands),
      },
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    if (options?.signal) {
      setTimeout(
        () => child.kill(options.signal),
        options.signalAfterMs ?? 200
      );
    }
    child.on("exit", (code) => resolve({ code, output }));
  });
}

async function pidsWithTitle(title: string): Promise<string[]> {
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "pid=,command="]);
  return stdout
    .split("\n")
    .filter((line) => line.includes(title))
    .map((line) => line.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

describe("start-prod supervisor", () => {
  it("exits with the child status and stops the sibling when one process dies", async () => {
    const title = `spt-sleep-${process.pid}-${Date.now()}`;
    const result = await runSupervisor([
      [
        process.execPath,
        [
          "-e",
          `process.title=${JSON.stringify(title)}; setInterval(() => {}, 1000)`,
        ],
      ],
      [process.execPath, ["-e", "setTimeout(() => process.exit(7), 200)"]],
    ]);

    expect(result.code).toBe(7);
    expect(result.output).toContain("stopping the other process");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await pidsWithTitle(title)).toEqual([]);
  });

  it("treats a clean child exit as a failure", async () => {
    const result = await runSupervisor([
      [process.execPath, ["-e", "setInterval(() => {}, 1000)"]],
      [process.execPath, ["-e", "process.exit(0)"]],
    ]);

    expect(result.code).toBe(1);
  });

  it("stops both children and exits 0 on SIGTERM", async () => {
    const title = `spt-term-${process.pid}-${Date.now()}`;
    const result = await runSupervisor(
      [
        [
          process.execPath,
          [
            "-e",
            `process.title=${JSON.stringify(title)}; setInterval(() => {}, 1000)`,
          ],
        ],
        [process.execPath, ["-e", "setInterval(() => {}, 1000)"]],
      ],
      { signal: "SIGTERM", signalAfterMs: 200 }
    );

    expect(result.code).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await pidsWithTitle(title)).toEqual([]);
  });
});
