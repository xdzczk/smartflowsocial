/**
 * Proves a scheduled, signed Nostr event can be published through the worker
 * path against the local signature-checking publisher.
 *
 * Requires Postgres and Redis from `pnpm docker`, and a schema applied with
 * `pnpm exec prisma db push`. Does not use a browser signer, a public relay,
 * or a Lightning wallet.
 *
 *   pnpm smoke:publish
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";
import { connect as connectNet } from "node:net";

import { finalizeEvent, getPublicKey } from "nostr-tools";

import { createLocalPublisher } from "./local-publisher.mjs";

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

function fail(line: string): never {
  process.stderr.write(`${line}\n`);
  process.exit(1);
}

function tcpReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connectNet({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"]?.trim() ?? "";
  const redisUrl = process.env["REDIS_URL"]?.trim() ?? "";
  if (!databaseUrl.startsWith("postgres")) {
    fail("DATABASE_URL is missing. Copy example.env and run pnpm docker.");
  }
  if (!redisUrl.startsWith("redis://")) {
    fail("REDIS_URL is missing. pnpm docker starts Redis on 127.0.0.1:6379.");
  }

  const redis = new URL(redisUrl);
  const redisPort = Number(redis.port || 6379);
  if (!(await tcpReachable(redis.hostname, redisPort))) {
    fail(
      `Redis is not accepting connections on ${redis.hostname}:${redisPort}. Run pnpm docker.`
    );
  }

  const sessionSecret = process.env["SESSION_SECRET"]?.trim() ?? "";
  process.env["NODE_ENV"] = "test";
  process.env["SESSION_SECRET"] =
    sessionSecret.length >= 32
      ? sessionSecret
      : "self-host-smoke-session-secret-32b";

  const token = "self-host-smoke-publisher-token";
  const publisher = createLocalPublisher({ token });
  const port = await publisher.listen(0, "127.0.0.1");
  process.env["NOSTR_PUBLISHER_URL"] = `http://127.0.0.1:${port}/publish`;
  process.env["NOSTR_PUBLISHER_API_TOKEN"] = token;

  const secretKey = randomBytes(32);
  const pubkey = getPublicKey(secretKey);
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: "SmartFlowSocial self-host smoke",
    },
    secretKey
  );

  const { prisma } = await import("~/lib/prisma.server");
  const { runScheduledPostJob } =
    await import("~/features/posts/queue-handlers/post-job.server");

  let userId = "";
  try {
    const user = await prisma.user.create({
      data: {
        npub: pubkey,
        isEnabled: true,
        publishRelaySource: "app",
        userRelays: ["wss://relay.example.test"],
      },
    });
    userId = user.id;
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        currentState: "SCHEDULED",
        content: event.content,
        postType: "TEXT",
        postKind: "POST",
        signingState: "signed",
        dependencyMode: "standalone",
        signedEvent: event,
        scheduledAtUtc: new Date(Date.now() - 60_000),
      },
    });

    const result = await runScheduledPostJob({
      job: {
        id: "self-host-smoke",
        attemptsMade: 0,
        data: {
          postId: post.id,
          userId: user.id,
          signedEvent: event,
          correlationId: "self-host-smoke",
        },
      } as never,
      startTime: Date.now(),
      ctx: { lease: null },
    });

    const stored = await prisma.post.findUnique({
      where: { id: post.id },
      select: { currentState: true, nostrEventId: true },
    });
    const seen = publisher.received.some((row) => row.event["id"] === event.id);
    if (!seen || stored?.currentState !== "PUBLISHED" || result.skipped) {
      fail(
        `Publish smoke failed. skipped=${String(result.skipped)} state=${stored?.currentState ?? "missing"} publisherReceived=${String(seen)}`
      );
    }
    if (stored.nostrEventId !== event.id) {
      fail("Published row did not store the signed event id.");
    }
    write(
      `self-host publish smoke passed post=${post.id} state=PUBLISHED publisher=local`
    );
  } finally {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await Promise.race([
      Promise.all([prisma.$disconnect(), publisher.close()]),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`self-host publish smoke failed: ${message}\n`);
  process.exit(1);
});
