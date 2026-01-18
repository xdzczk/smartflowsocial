import { createHash } from "node:crypto";

import { redis } from "~/infra/queue";
import { logWarning } from "~/lib/error-logger.server";
import {
  recordRedisCacheLatency,
  recordRedisCacheRequest,
} from "~/lib/metrics/cache-metrics.server";

function isRedisCacheEnabled(): boolean {
  // Keep tests deterministic: caching can interfere with mocked fetch expectations.
  return process.env["NODE_ENV"] !== "test";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function buildCacheKey(input: {
  namespace: string;
  version?: string;
  parts: Record<string, unknown>;
}): string {
  const version = input.version ?? "v1";
  const fingerprint = sha256Hex(stableStringify(input.parts));
  return `smartflow:${input.namespace}:${version}:${fingerprint}`;
}

export async function getJsonFromRedis<T>(input: {
  cache: string;
  key: string;
}): Promise<{ hit: true; value: T } | { hit: false }> {
  const start = Date.now();
  try {
    const raw = await redis.get(input.key);
    recordRedisCacheLatency(input.cache, "get", Date.now() - start);
    if (!raw) {
      recordRedisCacheRequest(input.cache, "miss");
      return { hit: false };
    }
    const parsed = JSON.parse(raw) as T;
    recordRedisCacheRequest(input.cache, "hit");
    return { hit: true, value: parsed };
  } catch (error) {
    recordRedisCacheLatency(input.cache, "get", Date.now() - start);
    recordRedisCacheRequest(input.cache, "error");
    logWarning("Redis cache get failed (bypassing)", {
      cache: input.cache,
      key: input.key,
      error: error instanceof Error ? error.message : String(error),
    });
    return { hit: false };
  }
}

export async function setJsonInRedis(input: {
  cache: string;
  key: string;
  value: unknown;
  ttlSeconds: number;
}): Promise<void> {
  const start = Date.now();
  try {
    await redis.set(
      input.key,
      JSON.stringify(input.value),
      "EX",
      input.ttlSeconds
    );
    recordRedisCacheLatency(input.cache, "set", Date.now() - start);
    recordRedisCacheRequest(input.cache, "set");
  } catch (error) {
    recordRedisCacheLatency(input.cache, "set", Date.now() - start);
    recordRedisCacheRequest(input.cache, "error");
    logWarning("Redis cache set failed (bypassing)", {
      cache: input.cache,
      key: input.key,
      ttlSeconds: input.ttlSeconds,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getOrSetJson<T>(input: {
  cache: string;
  key: string;
  ttlSeconds: number;
  compute: () => Promise<T>;
  /**
   * Cache empty arrays / empty objects / null-ish results with a shorter TTL.
   * Default: disabled.
   */
  negativeTtlSeconds?: number;
  shouldNegativeCache?: (value: T) => boolean;
}): Promise<T> {
  if (!isRedisCacheEnabled()) {
    recordRedisCacheRequest(input.cache, "bypass");
    const computeStart = Date.now();
    const value = await input.compute();
    recordRedisCacheLatency(input.cache, "compute", Date.now() - computeStart);
    return value;
  }

  const cached = await getJsonFromRedis<T>({
    cache: input.cache,
    key: input.key,
  });
  if (cached.hit) return cached.value;

  const computeStart = Date.now();
  const value = await input.compute();
  recordRedisCacheLatency(input.cache, "compute", Date.now() - computeStart);

  const shouldNeg =
    input.negativeTtlSeconds !== undefined &&
    (input.shouldNegativeCache?.(value) ?? false);

  const ttlSeconds = shouldNeg ? input.negativeTtlSeconds : input.ttlSeconds;
  if (ttlSeconds !== undefined) {
    await setJsonInRedis({
      cache: input.cache,
      key: input.key,
      value,
      ttlSeconds,
    });
  } else {
    recordRedisCacheRequest(input.cache, "bypass");
  }

  return value;
}
