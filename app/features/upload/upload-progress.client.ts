/**
 * Upload progress, retry, and adaptive queue.
 */

export const BLOSSOM_UPLOAD_RETRY_DELAYS_MS = [1000, 3000, 8000] as const;

export interface QueueTask<T = unknown> {
  index: number;
  fileName: string;
  run: () => Promise<T>;
}

export interface QueueConfig<_T = unknown> {
  totalFiles: number;
  startConcurrency: number;
  minConcurrency: number;
  maxConcurrency: number;
  adaptive: boolean;
  onProgress?: (current: number, total: number, fileName: string) => void;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function runAdaptiveUploadQueue<T>(
  tasks: Array<QueueTask<T>>,
  config: QueueConfig<T>
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let completed = 0;
  const latencies: number[] = [];
  const recentErrors: string[] = [];
  let adaptiveConcurrency = clamp(
    config.startConcurrency,
    config.minConcurrency,
    config.maxConcurrency
  );

  async function processTask(task: QueueTask<T>): Promise<void> {
    const startedAt = Date.now();
    const result = await task.run();
    results[task.index] = result;
    const latency = Date.now() - startedAt;
    latencies.push(latency);
    const res = result as { success?: boolean; error?: string };
    if (typeof res.success === "boolean" && !res.success) {
      recentErrors.push(res.error ?? "upload_failed");
    }
    completed++;

    config.onProgress?.(
      completed,
      config.totalFiles,
      `Uploading... ${completed} of ${config.totalFiles} files completed`
    );

    if (config.adaptive && completed % 10 === 0) {
      const recentLatency = latencies.slice(-10);
      const sorted = [...recentLatency].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const errorRate =
        recentErrors.slice(-10).filter(Boolean).length /
        Math.max(1, recentLatency.length);
      const hasRateSpike = recentErrors
        .slice(-10)
        .some((e) => e.includes("rate_limited"));

      if ((errorRate < 0.02 || median < 4000) && !hasRateSpike) {
        adaptiveConcurrency = Math.min(
          config.maxConcurrency,
          adaptiveConcurrency + 1
        );
      } else if (errorRate > 0.1 || hasRateSpike) {
        adaptiveConcurrency = Math.max(
          config.minConcurrency,
          adaptiveConcurrency - 1
        );
      }
    }
  }

  await new Promise<void>((resolve) => {
    let nextTaskIndex = 0;
    let active = 0;
    function pump(): void {
      if (completed >= tasks.length) {
        if (active === 0) resolve();
        return;
      }
      const targetConcurrency = config.adaptive
        ? clamp(
            adaptiveConcurrency,
            config.minConcurrency,
            config.maxConcurrency
          )
        : config.maxConcurrency;

      while (active < targetConcurrency && nextTaskIndex < tasks.length) {
        const task = tasks[nextTaskIndex++];
        if (!task) continue;
        active++;
        void processTask(task).finally(() => {
          active--;
          pump();
        });
      }
    }
    pump();
  });

  return results;
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// --- SFS retry / backoff ---

export interface SfsRetryDecision {
  type: "retry" | "refresh_token" | "fail";
  delayMs?: number;
  error?: string;
}

export function getSfsErrorMeta(error: unknown): {
  status?: number;
  errorCode?: string;
  retryAfter?: number;
} {
  if (!error || typeof error !== "object") {
    return {};
  }
  const payload = error as {
    status?: number;
    errorCode?: string;
    retryAfter?: number;
  };
  return {
    status: payload.status,
    errorCode: payload.errorCode,
    retryAfter: payload.retryAfter,
  };
}

export function decideSfsRetry(
  error: unknown,
  attempt: number,
  maxAttempts: number
): SfsRetryDecision {
  const { status, errorCode, retryAfter } = getSfsErrorMeta(error);
  if (errorCode === "sha256_mismatch") {
    return { type: "fail", error: "sha256_mismatch" };
  }
  if (
    status === 401 &&
    errorCode === "token_expired" &&
    attempt < maxAttempts
  ) {
    return { type: "refresh_token" };
  }
  if (status === 429 && attempt < maxAttempts) {
    return { type: "retry", delayMs: (retryAfter ?? 2) * 1000 };
  }
  if ((status == null || status >= 500) && attempt < maxAttempts) {
    return {
      type: "retry",
      delayMs:
        BLOSSOM_UPLOAD_RETRY_DELAYS_MS[
          Math.min(attempt - 1, BLOSSOM_UPLOAD_RETRY_DELAYS_MS.length - 1)
        ] ?? 8000,
    };
  }
  return {
    type: "fail",
    error: error instanceof Error ? error.message : "upload_failed",
  };
}
