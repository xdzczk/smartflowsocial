import * as promClient from "prom-client";

import { singleton } from "../singleton.server";

type CacheResult = "hit" | "miss" | "set" | "error" | "bypass";

function getOrCreateMetric<T extends promClient.Metric>(
  name: string,
  factory: () => T
): T {
  return singleton(`prom_metric_${name}`, () => {
    const registry = promClient.register;
    try {
      const existingMetric = registry.getSingleMetric(name);
      if (existingMetric) {
        return existingMetric as T;
      }
    } catch {
      // ignore
    }
    return factory();
  });
}

export const redisCacheRequestsCounter = getOrCreateMetric(
  "redis_cache_requests_total",
  () =>
    new promClient.Counter({
      name: "redis_cache_requests_total",
      help: "Total Redis cache operations",
      labelNames: ["cache", "result"] as const,
    })
);

export const redisCacheOpLatencyMs = getOrCreateMetric(
  "redis_cache_op_latency_ms",
  () =>
    new promClient.Histogram({
      name: "redis_cache_op_latency_ms",
      help: "Redis cache operation latency in milliseconds",
      labelNames: ["cache", "op"] as const,
      buckets: [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000],
    })
);

export function recordRedisCacheRequest(
  cache: string,
  result: CacheResult
): void {
  redisCacheRequestsCounter.inc({ cache, result });
}

export function recordRedisCacheLatency(
  cache: string,
  op: "get" | "set" | "compute",
  durationMs: number
): void {
  redisCacheOpLatencyMs.observe({ cache, op }, durationMs);
}
