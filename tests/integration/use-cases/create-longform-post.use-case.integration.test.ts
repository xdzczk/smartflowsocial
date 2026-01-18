/**
 * Integration tests for CreateLongFormPostUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "CreateLongFormPostUseCase"
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { CreateLongFormPostUseCase } from "~/features/posts/use-cases/create-longform-post.use-case.server";
import { prisma } from "~/lib/prisma.server";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const SHOULD_SKIP_DB_TESTS = process.env["SKIP_DATABASE_TESTS"] === "true";

describe.skipIf(!TEST_DATABASE_URL || SHOULD_SKIP_DB_TESTS)(
  "CreateLongFormPostUseCase Integration",
  () => {
    let userId: string;
    let useCase: CreateLongFormPostUseCase;

    beforeEach(async () => {
      // Create a test user - use upsert to handle duplicates
      const npub = `test-${Date.now()}-${Math.random()}`;
      const user = await prisma.user.upsert({
        where: { npub },
        update: {},
        create: {
          npub,
          isEnabled: true,
        },
      });
      userId = user.id;
      useCase = new CreateLongFormPostUseCase();
    });

    afterEach(async () => {
      // Clean up test data - handle missing tables gracefully
      if (userId) {
        try {
          const posts = await prisma.longFormPost.findMany({
            where: { userId },
            select: { id: true },
          });
          if (posts.length > 0) {
            await prisma.outboxEvent.deleteMany({
              where: {
                aggregateId: { in: posts.map((p) => p.id) },
              },
            });
          }
        } catch {
          // Table might not exist, ignore
        }
        try {
          await prisma.longFormPost.deleteMany({
            where: { userId },
          });
        } catch {
          // Ignore errors
        }
        try {
          await prisma.user.delete({
            where: { id: userId },
          });
        } catch {
          // Ignore errors
        }
      }
    });

    it("should create a draft longform post successfully", async () => {
      const result = await useCase.execute({
        userId,
        title: "Test Title",
        content: "Test content",
      });

      expect(result.post).toBeDefined();
      expect(result.post.userId).toBe(userId);
      expect(result.post.title).toBe("Test Title");
      expect(result.post.content).toBe("Test content");
      const { deriveIsPublishedLongForm, deriveIsScheduledLongForm } =
        await import("~/features/posts/state-machine/longform-post-state");
      expect(deriveIsPublishedLongForm(result.post.currentState)).toBe(false);
      expect(deriveIsScheduledLongForm(result.post.currentState)).toBe(false);
      expect(result.needsScheduling).toBe(false);
    });

    it("should create a scheduled longform post with outbox event", async () => {
      const scheduledFor = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const result = await useCase.execute({
        userId,
        title: "Test Title",
        content: "Test content",
        scheduledFor,
        signedEvent: {
          id: "test-event-id",
          pubkey: "test-pubkey",
          created_at: scheduledFor,
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
      });

      expect(result.post).toBeDefined();
      const { deriveIsScheduledLongForm } =
        await import("~/features/posts/state-machine/longform-post-state");
      expect(deriveIsScheduledLongForm(result.post.currentState)).toBe(true);
      expect(result.needsScheduling).toBe(true);

      // Verify outbox event was created
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: result.post.id,
          eventType: "LONGFORM_SCHEDULED",
        },
      });
      expect(outboxEvents.length).toBe(1);
    });
  }
);
