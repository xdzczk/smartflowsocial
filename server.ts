import { randomBytes } from "node:crypto";
import { webcrypto as nodeWebcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRequestHandler } from "@remix-run/express";
import type { ServerBuild } from "@remix-run/node";
import { broadcastDevReady, installGlobals } from "@remix-run/node";
import compression from "compression";
import { config } from "dotenv";
import type { RequestHandler } from "express";
import express from "express";
import helmet from "helmet";
import * as ipaddr from "ipaddr.js";
import morgan from "morgan";
import * as promClient from "prom-client";
import sourceMapSupport from "source-map-support";

// Load environment variables from .env file (if it exists)
// This must happen before any imports that use environment variables
config({ path: path.resolve(process.cwd(), ".env") });

import rateLimit from "express-rate-limit";

import { env } from "./app/lib/env.server";
import { logInfo, logWarning } from "./app/lib/error-logger.server";
import { updateRelayMetrics } from "./app/lib/metrics/relay-metrics.server";
import {
  apiLimiter,
  strictLimiter,
  authLimiter,
} from "./app/lib/rate-limit.server";

// Only install in production or when explicitly enabled to avoid missing map file errors in dev
if (env.NODE_ENV === "production" || env.ENABLE_SOURCE_MAPS === "true") {
  try {
    (
      sourceMapSupport as {
        install: (_options: {
          handleUncaughtExceptions: boolean;
          environment: string;
        }) => void;
      }
    ).install({
      handleUncaughtExceptions: false,
      environment: "node",
    });
  } catch (error) {
    // If source map support fails to install, log but don't crash
    logWarning("[Source Maps] Failed to install source map support", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
installGlobals();

// Handle uncaught exceptions from stream cancellation errors
// These can occur when aborting fetch requests whose response streams are already locked
process.on("uncaughtException", (error: Error) => {
  // Ignore stream cancellation errors - these are expected when aborting
  // requests whose response streams are already being consumed
  if (
    error.message.includes(
      "Cannot cancel a stream that already has a reader"
    ) ||
    (error.name === "TypeError" &&
      error.message.includes("stream") &&
      error.message.includes("reader"))
  ) {
    // Log but don't crash - this is a known issue with aborting locked streams
    logWarning("Stream cancellation error (ignored)", {
      error: error.message,
      stack: error.stack,
    });
    return;
  }

  // Re-throw other uncaught exceptions to maintain normal error handling
  throw error;
});

// Suppress DEP0169 deprecation warning from @opentelemetry/instrumentation-http
// This is a transitive dependency of @sentry/remix that uses url.parse()
// The warning is harmless and will be fixed when the dependency is updated
const originalEmitWarning = process.emitWarning;

process.emitWarning = function (warning: any, ...args: any[]) {
  if (
    typeof warning === "object" &&
    warning !== null &&
    "name" in warning &&
    "code" in warning &&
    warning.name === "DeprecationWarning" &&
    warning.code === "DEP0169"
  ) {
    // Suppress DEP0169 (url.parse deprecation) warnings
    return;
  }
  // Call original with all arguments - TypeScript types are too strict here

  return originalEmitWarning.call(this, warning, ...args);
};

// Ensure Web Crypto API exists for server-side code that expects browser crypto
interface GlobalWithCrypto {
  crypto?: Crypto;
}
const globalWithCrypto = globalThis as unknown as GlobalWithCrypto;
if (!globalWithCrypto.crypto?.getRandomValues) {
  globalWithCrypto.crypto = nodeWebcrypto as Crypto;
}

void run();

async function run() {
  const BUILD_PATH = path.resolve("build/index.js");
  const VERSION_PATH = path.resolve("build/version.txt");

  const initialBuild = await reimportServer();
  const remixHandler =
    env.NODE_ENV === "development"
      ? await createDevRequestHandler(initialBuild)
      : createRequestHandler({
          build: initialBuild,
          mode: initialBuild.mode,
          getLoadContext: (req, res) => {
            // Pass nonce to Remix loaders via context
            return {
              nonce: (res.locals as Record<string, unknown>)["nonce"] as
                | string
                | undefined,
            };
          },
        });

  const app = express();
  const metricsApp = express();

  // Trust proxy for accurate IP extraction (needed for Fly.io and other proxies)
  // Trust 1 proxy (Coolify's reverse proxy) to prevent IP spoofing
  app.set("trust proxy", 1);
  metricsApp.set("trust proxy", 1);

  // Import query metrics to register them
  await import("./app/lib/query-metrics.server");

  // Collect default metrics (CPU, memory, process info, etc.)
  promClient.collectDefaultMetrics();

  // Periodically export relay health into Prometheus gauges.
  // Note: relay health is updated during publish; this just syncs the latest values into the registry.
  const relayMetricsIntervalMs = 10_000;
  updateRelayMetrics();
  setInterval(() => {
    try {
      updateRelayMetrics();
    } catch {
      // Best-effort: never crash the web server because metrics export failed.
    }
  }, relayMetricsIntervalMs);

  // Expose Prometheus metrics endpoint with security protection
  metricsApp.get("/metrics", (req, res) => {
    void (async () => {
      // Validate token if provided
      const token =
        req.query["token"]?.toString() ??
        req.headers.authorization?.replace("Bearer ", "");

      if (env.METRICS_TOKEN) {
        if (!token || token !== env.METRICS_TOKEN) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }

      // Validate IP if allowlist provided
      if (env.METRICS_ALLOWED_IPS) {
        // Get client IP (handles proxies)
        const clientIp =
          (req.headers["x-forwarded-for"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ??
          (req.headers["x-real-ip"] as string | undefined) ??
          req.socket.remoteAddress ??
          req.ip ??
          "";

        if (!clientIp) {
          res.status(403).json({
            error: "Forbidden",
            message: "Unable to determine client IP address",
          });
          return;
        }

        const allowedIps = env.METRICS_ALLOWED_IPS.split(",").map((ip) =>
          ip.trim()
        );

        // Use ipaddr.js for proper CIDR matching (supports IPv4 and IPv6)
        let isAllowed = false;

        try {
          const clientAddr = ipaddr.process(clientIp);

          isAllowed = allowedIps.some((allowedIp) => {
            try {
              // Exact match
              if (clientIp === allowedIp) {
                return true;
              }

              // CIDR match (e.g., "10.0.0.0/8" or "2001:db8::/32")
              if (allowedIp.includes("/")) {
                const [prefix, maskStr] = allowedIp.split("/");
                if (!maskStr) {
                  return false;
                }
                const mask = parseInt(maskStr, 10);

                if (isNaN(mask) || mask < 0 || !prefix) {
                  return false;
                }

                try {
                  const prefixAddr = ipaddr.process(prefix);

                  // Both must be same type (IPv4 or IPv6)
                  if (clientAddr.kind() !== prefixAddr.kind()) {
                    return false;
                  }

                  // Check if client IP is within the CIDR range
                  if (clientAddr.kind() === "ipv4") {
                    const subnet = prefixAddr as ipaddr.IPv4;
                    const range = ipaddr.IPv4.subnetMaskFromPrefixLength(mask);
                    const clientIPv4 = clientAddr as ipaddr.IPv4;
                    // @ts-expect-error - ipaddr.js types may be incomplete, but match works correctly
                    return clientIPv4.match(subnet, range);
                  } else {
                    // IPv6
                    const subnet = prefixAddr as ipaddr.IPv6;
                    const range = ipaddr.IPv6.subnetMaskFromPrefixLength(mask);
                    const clientIPv6 = clientAddr as ipaddr.IPv6;
                    // @ts-expect-error - ipaddr.js types may be incomplete, but match works correctly
                    return clientIPv6.match(subnet, range);
                  }
                } catch {
                  // Invalid CIDR format
                  return false;
                }
              }

              // Try parsing as single IP for exact match
              const allowedAddr = ipaddr.process(allowedIp);
              return clientAddr.toString() === allowedAddr.toString();
            } catch {
              // Invalid IP format in allowlist - skip this entry
              return false;
            }
          });
        } catch (error) {
          // Invalid client IP format
          logWarning("Invalid client IP format", {
            clientIp,
            error: error instanceof Error ? error.message : String(error),
          });
          isAllowed = false;
        }

        if (!isAllowed) {
          res.status(403).json({
            error: "Forbidden",
            message: "IP address not allowed",
          });
          return;
        }
      }

      // If neither token nor IP allowlist is configured, allow in development only
      if (
        !env.METRICS_TOKEN &&
        !env.METRICS_ALLOWED_IPS &&
        env.NODE_ENV === "production"
      ) {
        logWarning(
          "Metrics endpoint is unprotected in production. Set METRICS_TOKEN or METRICS_ALLOWED_IPS.",
          { metricsPort }
        );
        // Still allow access but log warning
      }

      // Return metrics
      res.set("Content-Type", promClient.register.contentType);
      const metrics = await promClient.register.metrics();
      res.end(metrics);
    })();
  });

  app.use((req, res, next) => {
    // helpful headers:
    res.set("x-fly-region", env.FLY_REGION ?? "unknown");
    res.set("Strict-Transport-Security", `max-age=${60 * 60 * 24 * 365 * 100}`);

    // /clean-urls/ -> /clean-urls
    if (req.path.endsWith("/") && req.path.length > 1) {
      const query = req.url.slice(req.path.length);
      const safepath = req.path.slice(0, -1).replace(/\/+/g, "/");
      res.redirect(301, safepath + query);
      return;
    }
    next();
  });

  // if we're not in the primary region, then we need to make sure all
  // non-GET/HEAD/OPTIONS requests hit the primary region rather than read-only
  // Postgres DBs.
  // learn more: https://fly.io/docs/getting-started/multi-region-databases/#replay-the-request
  // Express 5: Use app.use() without path for catch-all middleware
  app.use(function getReplayResponse(req, res, next) {
    const { method, path: pathname } = req;
    const PRIMARY_REGION = env.PRIMARY_REGION;
    const FLY_REGION = env.FLY_REGION;

    const isMethodReplayable = !["GET", "OPTIONS", "HEAD"].includes(method);
    const isReadOnlyRegion =
      FLY_REGION && PRIMARY_REGION && FLY_REGION !== PRIMARY_REGION;

    const shouldReplay = isMethodReplayable && isReadOnlyRegion;

    if (!shouldReplay) return next();

    const replayInfo = {
      pathname,
      method,
      PRIMARY_REGION,
      FLY_REGION,
    };
    logInfo("Replaying request to primary region", replayInfo);
    res.set("fly-replay", `region=${PRIMARY_REGION}`);
    return res.sendStatus(409);
  });

  app.use(compression());

  // http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable("x-powered-by");

  // Generate CSP nonce for each request (better security than unsafe-eval)
  app.use((req, res, next) => {
    const nonce = randomBytes(16).toString("base64");
    (res.locals as Record<string, unknown>)["nonce"] = nonce;
    next();
  });

  // Security headers with Helmet
  // Configure CSP to work with Remix (which uses inline scripts/styles)
  // Remix doesn't support nonces natively, so we use 'unsafe-inline' for Remix's generated content
  // Nonces are still generated and used for our custom inline scripts (e.g., window.ENV)
  const isDevelopment = env.NODE_ENV === "development";

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Remix's generated scripts
            "'unsafe-eval'", // Required for some third-party client libraries
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Remix's generated styles
          ],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            "wss:", // WebSocket connections for Nostr
            "https:", // External API calls
            "http://127.0.0.1:7242", // Debug logging server
            ...(isDevelopment ? ["ws://localhost:3001"] : []), // Remix dev server WebSocket
          ],
          workerSrc: [
            "'self'",
            "blob:", // Required for Sentry workers
          ],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          // Allow local previews (blob:) and external video hosts (e.g. Blossom)
          mediaSrc: ["'self'", "blob:", "https:"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: !isDevelopment ? [] : null,
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: "deny",
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
      },
      // @ts-expect-error - permissionsPolicy may not be in helmet types but is valid
      permissionsPolicy: {
        features: {
          geolocation: ["'none'"],
          microphone: ["'none'"],
          camera: ["'none'"],
        },
      },
    })
  );

  // Additional custom security headers
  app.use((req, res, next) => {
    // X-Content-Type-Options: Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");

    // X-Frame-Options: Prevent clickjacking (redundant with helmet frameguard, but explicit)
    res.setHeader("X-Frame-Options", "DENY");

    // X-XSS-Protection: Enable XSS filter (legacy browsers)
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // Referrer-Policy: Control referrer information (redundant with helmet, but explicit)
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions-Policy: Control browser features (redundant with helmet, but explicit)
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()"
    );

    next();
  });

  // Remix fingerprints its assets so we can cache forever.
  const buildPath = path.resolve("public/build");
  app.use(
    "/build",
    express.static(buildPath, {
      immutable: true,
      maxAge: "1y",
    })
  );

  // Everything else (like favicon.ico) is cached for an hour.
  app.use(express.static(path.resolve("public"), { maxAge: "1h" }));

  app.use(morgan("tiny"));

  // Rate limiting
  // Apply general API rate limiting to all API routes
  app.use("/api/", apiLimiter);

  // Stricter limits for sensitive endpoints
  app.use("/api/publish", strictLimiter);

  // Very strict limits for authentication endpoints
  app.use("/api/payment-status", strictLimiter);

  // Auth endpoints get the strictest limits
  app.use("/login", authLimiter);
  app.use("/auth/nostr", authLimiter);

  // Rate limiting for post creation endpoints
  // Bulk posts: More lenient (5 requests per minute) since they're expensive but legitimate
  const isTestEnv =
    env.NODE_ENV === "test" ||
    process.env["E2E_TEST"] === "true" ||
    process.env["DISABLE_RATE_LIMIT"] === "true";

  // Upload endpoints need higher limits for bulk uploads (500 per 15 min)
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTestEnv ? 10000 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many upload requests, please try again later.",
    skip: () => isTestEnv,
  });
  app.use("/api/upload", uploadLimiter);
  app.use("/api/upload-blossom", uploadLimiter);
  app.use("/api/upload-editorjs-image", uploadLimiter);

  const bulkPostLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 10000 : 200, // 200 bulk page requests per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message:
      "Too many bulk post requests. Please wait before creating more bulk posts.",
    handler: (req, res) => {
      res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message:
          "Too many bulk post requests. Please wait before creating more bulk posts.",
        retryAfter: Math.ceil(
          ((req as { rateLimit?: { resetTime?: number } }).rateLimit
            ?.resetTime ?? Date.now() + 60 * 1000 - Date.now()) / 1000
        ),
      });
    },
    skip: () => isTestEnv,
  });

  // Single post creation: Stricter limits (10 requests per 15 minutes)
  app.use("/dashboard/newpost", strictLimiter);
  app.use("/dashboard/newlongform", strictLimiter);

  // Bulk post creation: More lenient frequency limit
  app.use("/dashboard/bulkposts", bulkPostLimiter);

  // Express 5: Use app.use() without path for catch-all route handler
  app.use(remixHandler);

  const port = parseInt(env.PORT ?? "3000", 10);
  const host = process.env["HOST"] ?? "0.0.0.0"; // Listen on all interfaces for Docker

  // Run database migrations and seed plans on startup
  async function initializeDatabase() {
    try {
      // Run pending migrations
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);
      logInfo("Running database migrations...");
      try {
        const { stdout, stderr } = await execAsync("npx prisma migrate deploy");
        if (stdout) {
          logInfo("Database migrations output", { stdout });
        }
        if (stderr) {
          logWarning("Database migrations stderr output", { stderr });
        }
        logInfo("Migrations applied successfully");
      } catch (migrationErr) {
        logWarning("Migration failed (may already be applied)", {
          error:
            migrationErr instanceof Error
              ? migrationErr.message
              : String(migrationErr),
        });
      }

      const { prisma } = await import("./app/lib/prisma.server");
      const existingPlans = await prisma.plan.count();
      if (existingPlans === 0) {
        logInfo("No plans found, seeding...");
        const plans = [
          {
            id: "free",
            name: "Free",
            price: 0,
            description: "Perfect for getting started",
            features: { basicScheduling: true },
            maxPostsPerMonth: 10,
            maxQueueTypes: 1,
            maxTemplates: 3,
            maxAssets: 10,
            maxLongFormPosts: 2,
            enableBasicScheduling: true,
            enableEngagementFeed: true,
            enableGiveaways: true,
          },
          {
            id: "basic",
            name: "Basic",
            price: 28,
            description: "For growing creators",
            features: { basicScheduling: true, multipleQueues: true },
            maxPostsPerMonth: 100,
            maxQueueTypes: 5,
            maxTemplates: 20,
            maxAssets: 100,
            maxLongFormPosts: 10,
            enableBasicScheduling: true,
            enableMultipleQueues: true,
            enableBulkScheduling: true,
            enableRepostsAndQuotes: true,
            enableEngagementFeed: true,
            enableGiveaways: true,
            enableLeaderboards: true,
            enableWolfFilteringAndVortex: true,
            enableNativeS3BlossomStorage: true,
          },
          {
            id: "premium",
            name: "Premium",
            price: 71,
            description: "For serious content creators",
            features: {
              basicScheduling: true,
              multipleQueues: true,
              advancedAnalytics: true,
            },
            maxPostsPerMonth: 500,
            maxQueueTypes: 15,
            maxTemplates: 50,
            maxAssets: 500,
            maxLongFormPosts: 25,
            enableBasicScheduling: true,
            enableMultipleQueues: true,
            enableBulkScheduling: true,
            enableRepostsAndQuotes: true,
            enableEngagementFeed: true,
            enableGiveaways: true,
            enableLeaderboards: true,
            enableAdvancedAnalytics: true,
            enableMultiAccountSwitching: true,
            enableWolfFilteringAndVortex: true,
            enableNativeS3BlossomStorage: true,
            enableRelayBlast: true,
          },
          {
            id: "founder",
            name: "Founder",
            price: 2600,
            description: "For early supporters",
            features: {
              basicScheduling: true,
              multipleQueues: true,
              lifetimeAccess: true,
            },
            maxPostsPerMonth: null,
            maxQueueTypes: null,
            maxTemplates: null,
            maxAssets: null,
            maxLongFormPosts: null,
            enableBasicScheduling: true,
            enableMultipleQueues: true,
            enableBulkScheduling: true,
            enableRepostsAndQuotes: true,
            enableEngagementFeed: true,
            enableGiveaways: true,
            enableLeaderboards: true,
            enableAdvancedAnalytics: true,
            enableMultiAccountSwitching: true,
            enableWolfFilteringAndVortex: true,
            enableNativeS3BlossomStorage: true,
            enableRelayBlast: true,
            enableVisualPerks: true,
            enableLifetimeAccess: true,
          },
        ];
        for (const plan of plans) {
          await prisma.plan.create({
            data: { ...plan, isActive: true, updatedAt: new Date() },
          });
        }
        logInfo("Plans seeded successfully");
      } else {
        logInfo("Plans already exist, skipping seed", { existingPlans });
      }
    } catch (err) {
      logWarning("Failed to initialize database (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Initialize database (migrations + seeding) before starting the server
  void initializeDatabase();

  app.listen(port, host, () => {
    logInfo("App ready", { host, port });

    if (env.NODE_ENV === "development") {
      void broadcastDevReady(initialBuild);
    }
  });

  const metricsPort = parseInt(env.METRICS_PORT ?? "3010", 10);

  metricsApp.listen(metricsPort, host, () => {
    logInfo("Metrics ready", { host, metricsPort });
  });

  async function reimportServer(): Promise<ServerBuild> {
    // cjs: manually remove the server build from the require cache
    Object.keys(require.cache).forEach((key) => {
      if (key.startsWith(BUILD_PATH)) {
        delete require.cache[key];
      }
    });

    const stat = fs.statSync(BUILD_PATH);

    // convert build path to URL for Windows compatibility with dynamic `import`
    const BUILD_URL = url.pathToFileURL(BUILD_PATH).href;

    // use a timestamp query parameter to bust the import cache
    return import(BUILD_URL + "?t=" + stat.mtimeMs);
  }

  async function createDevRequestHandler(
    initialBuild: ServerBuild
  ): Promise<RequestHandler> {
    let build = initialBuild;
    async function handleServerUpdate() {
      // 1. re-import the server build
      build = await reimportServer();
      // 2. tell Remix that this app server is now up-to-date and ready
      void broadcastDevReady(build);
    }
    const chokidar = await import("chokidar");
    chokidar
      .watch(VERSION_PATH, { ignoreInitial: true })
      .on("add", () => {
        void handleServerUpdate();
      })
      .on("change", () => {
        void handleServerUpdate();
      });

    // wrap request handler to make sure its recreated with the latest build for every request
    return (req, res, next) => {
      try {
        const handler = createRequestHandler({
          build,
          mode: "development",
          getLoadContext: () => {
            // Pass nonce to Remix loaders via context
            return {
              nonce: (res.locals as Record<string, unknown>)["nonce"] as
                | string
                | undefined,
            };
          },
        });
        void handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}
