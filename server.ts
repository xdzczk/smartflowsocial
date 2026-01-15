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
    console.warn("[Source Maps] Failed to install source map support:", error);
  }
}
installGlobals();

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
            "'unsafe-eval'", // Required for libraries like nostr-login that use eval()
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
  const buildPath = path.resolve("public/build");
  // #region agent log
  const buildPathExists = fs.existsSync(buildPath);
  const buildPathStats = buildPathExists ? fs.statSync(buildPath) : null;
  const cssFiles = buildPathExists
    ? fs
        .readdirSync(buildPath, { recursive: true })
        .filter((f): f is string => typeof f === "string" && f.endsWith(".css"))
    : [];

  // Get detailed info about CSS files including their sizes
  const cssFileDetails = cssFiles.map((file) => {
    const fullPath = path.join(buildPath, file);
    const stats = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;
    return {
      file,
      fullPath,
      size: stats?.size ?? 0,
      exists: stats !== null,
    };
  });

  const logData = {
    location: "server.ts:402",
    message: "Static build path resolved",
    data: {
      buildPath,
      exists: buildPathExists,
      isDirectory: buildPathStats?.isDirectory(),
      cssFiles,
      cssFileDetails,
      cwd: process.cwd(),
    },
    timestamp: Date.now(),
    sessionId: "debug-session",
    runId: "run1",
    hypothesisId: "B",
  };
  // Log to console for Coolify logs
  console.log("[CSS DEBUG]", JSON.stringify(logData));
  // Also try to send to debug endpoint (may fail in Docker)
  fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logData),
  }).catch(() => {});
  // #endregion

  // #region agent log
  app.use("/build", (req, res, next) => {
    // Log all /build requests to see what's being requested
    const isCss = req.path.endsWith(".css") || req.url.endsWith(".css");
    const requestLogData = {
      location: "server.ts:433",
      message: "Build path request",
      data: {
        path: req.path,
        url: req.url,
        originalUrl: req.originalUrl,
        isCss,
        method: req.method,
        headers: {
          "accept-encoding": req.headers["accept-encoding"],
          "if-none-match": req.headers["if-none-match"],
          "if-modified-since": req.headers["if-modified-since"],
        },
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    };
    // Log to console for Coolify logs
    console.log("[CSS DEBUG]", JSON.stringify(requestLogData));
    // Also try to send to debug endpoint (may fail in Docker)
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestLogData),
    }).catch(() => {});

    if (isCss) {
      // Try multiple path resolutions since Express strips mount point
      const possiblePaths = [
        path.join(buildPath, req.path),
        path.join(buildPath, req.url.replace("/build", "")),
        path.join(buildPath, req.originalUrl.replace("/build", "")),
      ];

      let cssPath = possiblePaths[0];
      let exists = false;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          cssPath = p;
          exists = true;
          break;
        }
      }

      let size = 0;
      let sampleContent = "";
      let hasUtilityClasses = false;
      let fileContentLength = 0;
      if (exists && cssPath) {
        try {
          const stats = fs.statSync(cssPath);
          size = stats.size;
          const content = fs.readFileSync(cssPath, "utf8");
          fileContentLength = content.length;
          sampleContent = content.substring(0, 500);
          hasUtilityClasses =
            content.includes(".container") ||
            content.includes(".grid") ||
            content.includes(".text-4xl") ||
            content.includes(".grid-cols");
          const cspHeader = res.getHeader("Content-Security-Policy");
          // Log BEFORE the static middleware serves the file
          const logData = {
            location: "server.ts:476",
            message: "CSS file found - BEFORE serving",
            data: {
              path: req.path,
              url: req.url,
              originalUrl: req.originalUrl,
              fullPath: cssPath,
              exists,
              fileSize: size,
              contentLength: fileContentLength,
              hasUtilityClasses,
              firstChars: sampleContent.substring(0, 100),
              lastChars: content.substring(Math.max(0, content.length - 100)),
              cspHeader: String(cspHeader),
              buildPath,
              cwd: process.cwd(),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "A",
          };
          // Log to console for Coolify logs
          console.log("[CSS DEBUG]", JSON.stringify(logData));
          // Also try to send to debug endpoint (may fail in Docker)
          fetch(
            "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(logData),
            }
          ).catch(() => {});

          // Intercept response to log what's actually sent
          // Express static middleware uses res.sendFile() or streams, so we need to intercept multiple methods
          // Using 'any' types for debugging instrumentation to avoid TypeScript overload complexity
          const originalSend = res.send.bind(res);
          const originalSendFile = res.sendFile.bind(res);
          const originalEnd = res.end.bind(res);

          // Track response size
          let responseSize = 0;
          const originalWrite = res.write.bind(res);

          (res as any).write = function (chunk: unknown, ...args: any[]) {
            if (chunk) {
              responseSize +=
                typeof chunk === "string"
                  ? Buffer.byteLength(chunk, "utf8")
                  : (chunk as Buffer)?.length || 0;
            }
            return originalWrite(chunk, ...args);
          };

          (res as any).send = function (body: unknown) {
            const bodySize =
              typeof body === "string"
                ? Buffer.byteLength(body, "utf8")
                : (body as Buffer)?.length || 0;
            responseSize = bodySize;
            const responseLogData = {
              location: "server.ts:528",
              message: "CSS file response sent (via res.send)",
              data: {
                path: req.path,
                url: req.url,
                fileSize: size,
                responseBodySize: bodySize,
                sizeMatch: size === bodySize,
                statusCode: res.statusCode,
                contentEncoding: res.getHeader("content-encoding"),
                contentLength: res.getHeader("content-length"),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            };
            console.log("[CSS DEBUG]", JSON.stringify(responseLogData));
            return originalSend(body);
          };

          (res as any).sendFile = function (filePath: string, ...args: any[]) {
            const responseLogData = {
              location: "server.ts:560",
              message: "CSS file response sent (via res.sendFile)",
              data: {
                path: req.path,
                url: req.url,
                filePath,
                fileSize: size,
                statusCode: res.statusCode,
                contentEncoding: res.getHeader("content-encoding"),
                contentLength: res.getHeader("content-length"),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            };
            console.log("[CSS DEBUG]", JSON.stringify(responseLogData));
            return originalSendFile(filePath, ...args);
          };

          (res as any).end = function (chunk?: unknown, ...args: any[]) {
            if (chunk) {
              responseSize +=
                typeof chunk === "string"
                  ? Buffer.byteLength(chunk, "utf8")
                  : (chunk as Buffer)?.length || 0;
            }
            // Get actual Content-Length header (compressed size if compression is enabled)
            const contentLengthHeader = res.getHeader("content-length");
            const contentLengthValue =
              typeof contentLengthHeader === "string"
                ? parseInt(contentLengthHeader, 10)
                : typeof contentLengthHeader === "number"
                  ? contentLengthHeader
                  : null;
            const responseLogData = {
              location: "server.ts:585",
              message: "CSS file response ended",
              data: {
                path: req.path,
                url: req.url,
                fileSize: size,
                responseSize,
                sizeMatch: size === responseSize,
                statusCode: res.statusCode,
                contentEncoding: res.getHeader("content-encoding"),
                contentLengthHeader: contentLengthValue,
                // Log all response headers to see what's actually being sent
                responseHeaders: Object.keys(res.getHeaders()).reduce(
                  (acc, key) => {
                    acc[key] = String(res.getHeader(key));
                    return acc;
                  },
                  {} as Record<string, string>
                ),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            };
            console.log("[CSS DEBUG]", JSON.stringify(responseLogData));
            return originalEnd(chunk, ...args);
          };
        } catch (err) {
          fetch(
            "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "server.ts:476",
                message: "CSS file read error",
                data: { path: req.path, url: req.url, error: String(err) },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "A",
              }),
            }
          ).catch(() => {});
        }
      } else {
        fetch(
          "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "server.ts:476",
              message: "CSS file not found",
              data: {
                path: req.path,
                url: req.url,
                originalUrl: req.originalUrl,
                triedPaths: possiblePaths,
                buildPath,
                cwd: process.cwd(),
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "B",
            }),
          }
        ).catch(() => {});
      }
    }
    next();
  });
  // #endregion

  app.use(
    "/build",
    express.static(buildPath, {
      immutable: true,
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        // Add cache-busting and ensure no stale cache for CSS files
        if (filePath.endsWith(".css")) {
          // Force Cloudflare to re-validate cache by adding ETag and Last-Modified
          const stats = fs.statSync(filePath);
          const etag = `"${stats.size}-${stats.mtimeMs}"`;
          res.setHeader("ETag", etag);
          res.setHeader("Last-Modified", stats.mtime.toUTCString());
          // Temporarily disable caching to force Cloudflare to fetch fresh file
          // Once confirmed working, we can re-enable caching
          res.setHeader(
            "Cache-Control",
            "no-cache, no-store, must-revalidate, max-age=0"
          );
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          res.setHeader("X-Content-Type-Options", "nosniff");
          // Add Cloudflare-specific headers to bypass cache
          res.setHeader("CF-Cache-Status", "DYNAMIC");
          // Log what file is being served
          const staticLogData = {
            location: "server.ts:643",
            message: "Static middleware serving CSS",
            data: {
              filePath,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
              etag,
              cwd: process.cwd(),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "A",
          };
          // Log to console for Coolify logs
          console.log("[CSS DEBUG]", JSON.stringify(staticLogData));
          // Also try to send to debug endpoint (may fail in Docker)
          fetch(
            "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(staticLogData),
            }
          ).catch(() => {});
        }
      },
    })
  );

  // Everything else (like favicon.ico) is cached for an hour. You may want to be
  // more aggressive with this caching.
  app.use(express.static(path.resolve("public"), { maxAge: "1h" }));

  // Log all requests to see if CSS requests are reaching the server
  app.use((req, res, next) => {
    if (req.url.includes(".css") || req.path.includes(".css")) {
      const allRequestLog = {
        location: "server.ts:655",
        message: "CSS request detected",
        data: {
          method: req.method,
          url: req.url,
          path: req.path,
          originalUrl: req.originalUrl,
          headers: {
            "accept-encoding": req.headers["accept-encoding"],
            "if-none-match": req.headers["if-none-match"],
            "if-modified-since": req.headers["if-modified-since"],
            "cache-control": req.headers["cache-control"],
          },
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      };
      console.log("[CSS DEBUG]", JSON.stringify(allRequestLog));
    }
    next();
  });

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

  // Rate limiting for post creation endpoints
  // Bulk posts: More lenient (5 requests per minute) since they're expensive but legitimate
  const isTestEnv =
    env.NODE_ENV === "test" ||
    process.env["E2E_TEST"] === "true" ||
    process.env["DISABLE_RATE_LIMIT"] === "true";

  const bulkPostLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isTestEnv ? 10000 : 5, // 5 bulk requests per minute per IP
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
  app.listen(port, host, () => {
    console.log(`✅ app ready: http://${host}:${port}`);

    if (env.NODE_ENV === "development") {
      void broadcastDevReady(initialBuild);
    }
  });

  const metricsPort = parseInt(env.METRICS_PORT ?? "3010", 10);

  metricsApp.listen(metricsPort, host, () => {
    console.log(`✅ metrics ready: http://${host}:${metricsPort}/metrics`);
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
