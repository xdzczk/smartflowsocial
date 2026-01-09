/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting functionality to protect against abuse, DDoS attacks, and API exhaustion.
 * Uses both in-memory (express-rate-limit) and Redis-based (rate-limiter-flexible) rate limiting.
 */

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { RateLimiterRedis } from "rate-limiter-flexible";

import { redis } from "~/infra/queue/queue-client.server";

/**
 * Check if we're in a test environment
 * Rate limiting should be disabled or relaxed in test environments
 * This is checked at request time, not module load time, to support dynamic env vars
 */
function isTestEnvironment(): boolean {
  // Check environment variables at request time
  const nodeEnv = process.env["NODE_ENV"];
  const cypress = process.env["CYPRESS"];
  const e2eTest = process.env["E2E_TEST"];
  const disableRateLimit = process.env["DISABLE_RATE_LIMIT"];

  return (
    nodeEnv === "test" ||
    cypress === "true" ||
    e2eTest === "true" ||
    disableRateLimit === "true"
  );
}

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 * Disabled in test environments
 */
const RATE_LIMIT_MESSAGE = "Too many requests, please try again later.";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnvironment() ? 10000 : 100, // Very high limit in tests, normal in production
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: RATE_LIMIT_MESSAGE,
  handler: (req: Request, res: Response) => {
    const rateLimitMessage = RATE_LIMIT_MESSAGE;
    res.status(429).json({
      error: "Rate limit exceeded",
      message: rateLimitMessage,
      retryAfter: Math.ceil(
        (req.rateLimit?.resetTime ?? Date.now() + 15 * 60 * 1000 - Date.now()) /
          1000
      ),
    });
  },
  skip: (_req: Request) => isTestEnvironment(), // Skip rate limiting entirely in test environments
});

/**
 * Strict rate limiter for sensitive endpoints
 * Limits: 10 requests per 15 minutes per IP
 * Disabled in test environments
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnvironment() ? 10000 : 10, // Very high limit in tests, normal in production
  standardHeaders: true,
  legacyHeaders: false,
  message: "Rate limit exceeded for this endpoint.",
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: "Rate limit exceeded for this endpoint. Please try again later.",
      retryAfter: Math.ceil(
        (req.rateLimit?.resetTime ?? Date.now() + 15 * 60 * 1000 - Date.now()) /
          1000
      ),
    });
  },
  skip: (_req: Request) => isTestEnvironment(), // Skip rate limiting entirely in test environments
});

/**
 * Very strict rate limiter for authentication endpoints
 * Limits: 5 requests per 15 minutes per IP
 * Disabled in test environments
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnvironment() ? 10000 : 5, // Very high limit in tests, normal in production
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later.",
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many authentication attempts, please try again later.",
      retryAfter: Math.ceil(
        (req.rateLimit?.resetTime ?? Date.now() + 15 * 60 * 1000 - Date.now()) /
          1000
      ),
    });
  },
  skip: (_req: Request) => isTestEnvironment(), // Skip rate limiting entirely in test environments
});

/**
 * Check if Redis is available for rate limiting
 */
function isRedisAvailable(): boolean {
  return !!process.env["REDIS_URL"] && redis.status === "ready";
}

/**
 * Per-user rate limiting middleware
 * Uses Redis for distributed rate limiting across multiple server instances
 *
 * @param points - Number of requests allowed
 * @param duration - Time window in seconds
 */
export function createUserRateLimiter(points = 100, duration = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Get user ID from request (set by auth middleware)
    const userId = req.user?.id;

    if (!userId) {
      // No user ID, skip rate limiting (will be handled by IP-based limiter)
      next();
      return;
    }

    if (!isRedisAvailable()) {
      // Redis not available, skip Redis-based rate limiting
      next();
      return;
    }

    try {
      // Create a per-user limiter with custom points/duration
      const userLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rl:user`,
        points,
        duration,
        blockDuration: duration,
      });

      await userLimiter.consume(userId);
      next();
    } catch (error: unknown) {
      // Rate limit exceeded
      // rate-limiter-flexible throws errors with msBeforeNext property
      const rateLimitError = error as { msBeforeNext?: number };
      const retryAfter = rateLimitError.msBeforeNext
        ? Math.ceil(rateLimitError.msBeforeNext / 1000)
        : duration;

      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests, please try again later.",
        retryAfter,
      });
    }
  };
}

/**
 * Per-IP rate limiting using Redis (for distributed systems)
 * Falls back to in-memory limiter if Redis is not available
 */
export function createIPRateLimiter(points = 100, duration = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isRedisAvailable()) {
      // Redis not available, skip Redis-based rate limiting
      // Will be handled by express-rate-limit middleware
      next();
      return;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    try {
      const ipLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rl:ip`,
        points,
        duration,
        blockDuration: duration,
      });

      await ipLimiter.consume(ip);
      next();
    } catch (error: unknown) {
      // Rate limit exceeded
      // rate-limiter-flexible throws errors with msBeforeNext property
      const rateLimitError = error as { msBeforeNext?: number };
      const retryAfter = rateLimitError.msBeforeNext
        ? Math.ceil(rateLimitError.msBeforeNext / 1000)
        : duration;

      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests from this IP, please try again later.",
        retryAfter,
      });
    }
  };
}

/**
 * Helper to get rate limit info for a user
 * Useful for displaying rate limit status to users
 */
export async function getRateLimitInfo(userId: string): Promise<{
  remaining: number;
  resetTime: number;
} | null> {
  if (!isRedisAvailable()) {
    return Promise.resolve(null);
  }

  try {
    const userLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: `rl:user`,
      points: 100,
      duration: 60,
    });

    const info = await userLimiter.get(userId);

    if (!info) {
      return Promise.resolve({
        remaining: 100, // Default points
        resetTime: Date.now() + 60 * 1000, // Default duration
      });
    }

    return Promise.resolve({
      remaining: info.remainingPoints,
      resetTime: Date.now() + info.msBeforeNext,
    });
  } catch (error) {
    console.error("Error getting rate limit info:", error);
    return Promise.resolve(null);
  }
}
