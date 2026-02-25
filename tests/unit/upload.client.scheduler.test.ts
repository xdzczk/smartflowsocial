import { describe, expect, it } from "vitest";

import { __uploadClientTestUtils } from "~/features/upload/upload.client";

describe("upload.client scheduler", () => {
  it("caps concurrency when adaptive mode is disabled", async () => {
    let active = 0;
    let observedMax = 0;
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      index,
      fileName: `file-${index}`,
      run: async () => {
        active++;
        observedMax = Math.max(observedMax, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
        return { success: true };
      },
    }));

    const results = await __uploadClientTestUtils.runAdaptiveUploadQueue(
      tasks,
      {
        totalFiles: tasks.length,
        startConcurrency: 1,
        minConcurrency: 1,
        maxConcurrency: 3,
        adaptive: false,
      }
    );

    expect(results).toHaveLength(tasks.length);
    expect(results.every((result) => result.success)).toBe(true);
    expect(observedMax).toBeLessThanOrEqual(3);
  });

  it("retries rate-limited responses with retry-after delay", () => {
    const decision = __uploadClientTestUtils.decideSfsRetry(
      {
        status: 429,
        errorCode: "rate_limited",
        retryAfter: 9,
      },
      1,
      4
    );

    expect(decision.type).toBe("retry");
    expect(decision.delayMs).toBe(9000);
  });
});
