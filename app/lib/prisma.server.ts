import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { env } from "./env.server";
import { recordQueryMetrics } from "./query-metrics.server";
import { singleton } from "./singleton.server";
// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton("prisma", getPrismaClient);

function getPrismaClient() {
  // Use validated env object to ensure DATABASE_URL is set and valid
  const DATABASE_URL = env.DATABASE_URL;

  const databaseUrl = new URL(DATABASE_URL);

  const isLocalHost = databaseUrl.hostname === "localhost";

  const PRIMARY_REGION = isLocalHost ? null : env.PRIMARY_REGION;
  const FLY_REGION = isLocalHost ? null : env.FLY_REGION;

  const isReadReplicaRegion = !PRIMARY_REGION || PRIMARY_REGION === FLY_REGION;

  if (!isLocalHost) {
    if (databaseUrl.host.endsWith(".internal")) {
      databaseUrl.host = `${String(FLY_REGION ?? "")}.${databaseUrl.host}`;
    }

    if (!isReadReplicaRegion) {
      // 5433 is the read-replica port
      databaseUrl.port = "5433";
    }
  }

  // NOTE: during development if you change anything in this function, remember
  // that this only runs once per server restart and won't automatically be
  // re-run per request like everything else is. So if you need to change
  // something in this file, you'll need to manually restart the server.
  // Prisma 7: datasources option is no longer supported in constructor
  // We need to set DATABASE_URL environment variable for dynamic URLs
  const finalDatabaseUrl = databaseUrl.toString();

  // Set the environment variable for Prisma 7 to pick up
  // This is safe because we're in a singleton function that only runs once
  process.env["DATABASE_URL"] = finalDatabaseUrl;

  // Prisma 7: Use PostgreSQL adapter for the "client" engine type
  // Create a connection pool for the adapter
  const pool = new Pool({
    connectionString: finalDatabaseUrl,
    // Connection pool configuration
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
  });

  // Create the Prisma adapter using the connection pool
  const adapter = new PrismaPg(pool);

  const baseClient = new PrismaClient({
    adapter: adapter, // Use adapter for Prisma 7 client engine type
    // Enable query logging in development for performance monitoring
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

  // Add query performance monitoring middleware using $extends (Prisma 5+)
  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const before = Date.now();
          let error: Error | undefined;

          try {
            const result = await query(args);
            const after = Date.now();
            const duration = after - before;

            // Record metrics
            // model is always string in Prisma's $allOperations callback
            recordQueryMetrics(model, operation, duration, true);

            // Log slow queries (over 100ms)
            if (duration > 100) {
              console.warn(
                `⚠️ Slow query detected: ${model}.${operation} took ${duration}ms`,
                {
                  model,
                  operation,
                  duration,
                  args,
                }
              );
            }

            return result;
          } catch (err) {
            error = err instanceof Error ? err : new Error(String(err));
            const after = Date.now();
            const duration = after - before;

            // Record error metrics
            // model is always string in Prisma's $allOperations callback
            recordQueryMetrics(model, operation, duration, false, error);

            // Log query errors

            console.error(
              `❌ Query error: ${model}.${operation} failed after ${duration}ms`,
              {
                model,
                operation,
                error: error.message,
                duration,
              }
            );

            throw err;
          }
        },
      },
    },
  });

  // connect eagerly
  void client.$connect();

  return client;
}

export { prisma };
