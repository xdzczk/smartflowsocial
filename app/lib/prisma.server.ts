import { PrismaClient } from "@prisma/client";
import invariant from "tiny-invariant";

import { singleton } from "./singleton.server";
import { recordQueryMetrics } from "./query-metrics.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton("prisma", getPrismaClient);

function getPrismaClient() {
  const { DATABASE_URL } = process.env;
  invariant(typeof DATABASE_URL === "string", "DATABASE_URL env var not set");

  const databaseUrl = new URL(DATABASE_URL);

  const isLocalHost = databaseUrl.hostname === "localhost";

  const PRIMARY_REGION = isLocalHost ? null : process.env.PRIMARY_REGION;
  const FLY_REGION = isLocalHost ? null : process.env.FLY_REGION;

  const isReadReplicaRegion = !PRIMARY_REGION || PRIMARY_REGION === FLY_REGION;

  if (!isLocalHost) {
    if (databaseUrl.host.endsWith(".internal")) {
      databaseUrl.host = `${FLY_REGION}.${databaseUrl.host}`;
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
  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl.toString(),
      },
    },
    // Enable query logging in development for performance monitoring
    log: process.env.NODE_ENV === "development" 
      ? ["query", "info", "warn", "error"]
      : ["error"],
  });
  
  // Add query performance monitoring middleware
  client.$use(async (params, next) => {
    const before = Date.now();
    let success = true;
    let error: Error | undefined;
    
    try {
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;
      
      // Record metrics
      recordQueryMetrics(
        params.model || "unknown",
        params.action,
        duration,
        true,
      );
      
      // Log slow queries (over 100ms)
      if (duration > 100) {
        console.warn(
          `⚠️ Slow query detected: ${params.model}.${params.action} took ${duration}ms`,
          {
            model: params.model,
            action: params.action,
            duration,
            args: params.args,
          },
        );
      }
      
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err : new Error(String(err));
      const after = Date.now();
      const duration = after - before;
      
      // Record error metrics
      recordQueryMetrics(
        params.model || "unknown",
        params.action,
        duration,
        false,
        error,
      );
      
      // Log query errors
      console.error(
        `❌ Query error: ${params.model}.${params.action} failed after ${duration}ms`,
        {
          model: params.model,
          action: params.action,
          error: error.message,
          duration,
        },
      );
      
      throw err;
    }
  });
  
  // connect eagerly
  client.$connect();

  return client;
}

export { prisma };
