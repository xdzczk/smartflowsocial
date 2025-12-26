import { webcrypto as nodeWebcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import prom from "@isaacs/express-prometheus-middleware";
import { createRequestHandler } from "@remix-run/express";
import type { ServerBuild } from "@remix-run/node";
import { broadcastDevReady, installGlobals } from "@remix-run/node";
import compression from "compression";
import type { RequestHandler } from "express";
import express from "express";
import morgan from "morgan";
import sourceMapSupport from "source-map-support";

import {
  apiLimiter,
  strictLimiter,
  authLimiter,
} from "./app/lib/rate-limit.server";
import helmet from "helmet";

sourceMapSupport.install();
installGlobals();

// Ensure Web Crypto API exists for server-side code that expects browser crypto
if (!(globalThis as any).crypto || !(globalThis as any).crypto.getRandomValues) {
  (globalThis as any).crypto = nodeWebcrypto as any;
}

/**
 * Validate required environment variables at startup
 * Prevents the application from starting with missing critical configuration
 */
function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'NOSTR_PUBLISHER_URL',
    'REDIS_URL',
  ];

  // Storage variables are optional - only required if using image uploads
  // If any storage variable is set, all must be set
  const storageVariables = [
    'STORAGE_ACCESS_KEY',
    'STORAGE_SECRET',
    'STORAGE_REGION',
    'STORAGE_BUCKET',
  ];

  const missing: string[] = [];
  const invalid: Array<{ key: string; reason: string }> = [];

  for (const key of required) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    } else {
      // Additional validation for specific variables
      if (key === 'SESSION_SECRET' && value.length < 32) {
        invalid.push({
          key,
          reason: 'must be at least 32 characters long',
        });
      }
      if (key === 'DATABASE_URL' && !value.startsWith('postgresql://')) {
        invalid.push({
          key,
          reason: 'must be a valid PostgreSQL connection string (postgresql://...)',
        });
      }
      if (key === 'REDIS_URL' && !value.startsWith('redis://')) {
        invalid.push({
          key,
          reason: 'must be a valid Redis connection string (redis://...)',
        });
      }
    }
  }

  // Validate storage variables: if any is set, all must be set
  const storageValues = storageVariables.map(key => process.env[key]);
  const hasSomeStorage = storageValues.some(v => v && v.trim() !== '');
  const hasAllStorage = storageValues.every(v => v && v.trim() !== '');

  if (hasSomeStorage && !hasAllStorage) {
    missing.push(...storageVariables.filter(key => {
      const value = process.env[key];
      return !value || value.trim() === '';
    }));
  }

  if (missing.length > 0 || invalid.length > 0) {
    console.error('❌ Environment validation failed:');
    
    if (missing.length > 0) {
      console.error('\nMissing required environment variables:');
      missing.forEach((key) => console.error(`  - ${key}`));
    }
    
    if (invalid.length > 0) {
      console.error('\nInvalid environment variables:');
      invalid.forEach(({ key, reason }) =>
        console.error(`  - ${key}: ${reason}`),
      );
    }
    
    console.error(
      '\nPlease check your .env file or environment configuration.',
    );
    console.error(
      'See docs/environment-setup.md for detailed configuration instructions.',
    );
    
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

// Validate environment before starting
validateEnvironment();

run();

async function run() {
  const BUILD_PATH = path.resolve("build/index.js");
  const VERSION_PATH = path.resolve("build/version.txt");

  const initialBuild = await reimportServer();
  const remixHandler =
    process.env.NODE_ENV === "development"
      ? await createDevRequestHandler(initialBuild)
      : createRequestHandler({
          build: initialBuild,
          mode: initialBuild.mode,
        });

  const app = express();
  const metricsApp = express();
  
  // Import query metrics to register them
  await import("./app/lib/query-metrics.server");
  
  app.use(
    prom({
      metricsPath: "/metrics",
      collectDefaultMetrics: true,
      metricsApp,
    }),
  );

  app.use((req, res, next) => {
    // helpful headers:
    res.set("x-fly-region", process.env.FLY_REGION ?? "unknown");
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
    const { PRIMARY_REGION, FLY_REGION } = process.env;

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
  const isDevelopment = process.env.NODE_ENV === "development";
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
      permissionsPolicy: {
        features: {
          geolocation: ["'none'"],
          microphone: ["'none'"],
          camera: ["'none'"],
        },
      },
    }),
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
      "geolocation=(), microphone=(), camera=()",
    );
    
    next();
  });

  // Remix fingerprints its assets so we can cache forever.
  app.use(
    "/build",
    express.static("public/build", { immutable: true, maxAge: "1y" }),
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

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✅ app ready: http://localhost:${port}`);

    if (process.env.NODE_ENV === "development") {
      broadcastDevReady(initialBuild);
    }
  });

  const metricsPort = process.env.METRICS_PORT || 3010;

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
    initialBuild: ServerBuild,
  ): Promise<RequestHandler> {
    let build = initialBuild;
    async function handleServerUpdate() {
      // 1. re-import the server build
      build = await reimportServer();
      // 2. tell Remix that this app server is now up-to-date and ready
      broadcastDevReady(build);
    }
    const chokidar = await import("chokidar");
    chokidar
      .watch(VERSION_PATH, { ignoreInitial: true })
      .on("add", handleServerUpdate)
      .on("change", handleServerUpdate);

    // wrap request handler to make sure its recreated with the latest build for every request
    return async (req, res, next) => {
      try {
        return createRequestHandler({
          build,
          mode: "development",
        })(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}
