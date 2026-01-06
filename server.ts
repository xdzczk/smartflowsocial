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

import { env } from "./app/lib/env.server";
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
        install: (options: {
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
    console.warn("[Source Maps] Failed to install source map support:", error);
  }
}
installGlobals();

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
        });

  const app = express();
  const metricsApp = express();

  // Trust proxy for accurate IP extraction (needed for Fly.io and other proxies)
  metricsApp.set("trust proxy", true);

  // Import query metrics to register them
  await import("./app/lib/query-metrics.server");

  // Collect default metrics (CPU, memory, process info, etc.)
  promClient.collectDefaultMetrics();

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
          console.warn("Invalid client IP format:", clientIp, error);
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
        console.warn(
          "⚠️  Metrics endpoint is unprotected in production. Set METRICS_TOKEN or METRICS_ALLOWED_IPS."
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
  app.all("*", function getReplayResponse(req, res, next) {
    const { method, path: pathname } = req;
    const PRIMARY_REGION = env.PRIMARY_REGION;
    const FLY_REGION = env.FLY_REGION;

    const isMethodReplayable = !["GET", "OPTIONS", "HEAD"].includes(method);
    const isReadOnlyRegion =
      FLY_REGION && PRIMARY_REGION && FLY_REGION !== PRIMARY_REGION;

    const shouldReplay = isMethodReplayable && isReadOnlyRegion;

    if (!shouldReplay) return next();

    const logInfo = {
      pathname,
      method,
      PRIMARY_REGION,
      FLY_REGION,
    };
    console.info(`Replaying:`, logInfo);
    res.set("fly-replay", `region=${PRIMARY_REGION}`);
    return res.sendStatus(409);
  });

  app.use(compression());

  // http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable("x-powered-by");

  // Security headers with Helmet
  // Configure CSP to work with Remix (which uses inline scripts/styles)
  // In production, we remove 'unsafe-eval' for better security
  const isDevelopment = env.NODE_ENV === "development";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'", // Required for Remix
    ...(isDevelopment ? ["'unsafe-eval'"] : []), // Only in development
  ];

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc,
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Remix
          ],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            "wss:", // WebSocket connections for Nostr
            "https:", // External API calls
            ...(isDevelopment ? ["ws://localhost:3001"] : []), // Remix dev server WebSocket
          ],
          workerSrc: [
            "'self'",
            "blob:", // Required for Sentry workers
          ],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
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
  app.use(
    "/build",
    express.static("public/build", { immutable: true, maxAge: "1y" })
  );

  // Everything else (like favicon.ico) is cached for an hour. You may want to be
  // more aggressive with this caching.
  app.use(express.static("public", { maxAge: "1h" }));

  app.use(morgan("tiny"));

  // Rate limiting
  // Apply general API rate limiting to all API routes
  app.use("/api/", apiLimiter);

  // Stricter limits for sensitive endpoints
  app.use("/api/publish", strictLimiter);
  app.use("/api/upload", strictLimiter);
  app.use("/api/upload-blossom", strictLimiter);
  app.use("/api/upload-editorjs-image", strictLimiter);

  // Very strict limits for authentication endpoints
  app.use("/api/payment-status", strictLimiter);

  // Auth endpoints get the strictest limits
  app.use("/login", authLimiter);
  app.use("/nostr-auth", authLimiter);

  app.all("*", remixHandler);

  const port = parseInt(env.PORT ?? "3000", 10);
  app.listen(port, () => {
    console.log(`✅ app ready: http://localhost:${port}`);

    if (env.NODE_ENV === "development") {
      void broadcastDevReady(initialBuild);
    }
  });

  const metricsPort = parseInt(env.METRICS_PORT ?? "3010", 10);

  metricsApp.listen(metricsPort, () => {
    console.log(`✅ metrics ready: http://localhost:${metricsPort}/metrics`);
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
        });
        void handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}
