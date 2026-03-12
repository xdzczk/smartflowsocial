/**
 * Integration tests for ScheduleLongFormPostUseCase
 * Tests the use case with real database interactions
 *
 * Note: These tests require a test database to be set up.
 * Run with: pnpm test:db:setup && pnpm test:integration -- --grep "ScheduleLongFormPostUseCase"
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  CreateLongFormPostUseCase,
  ScheduleLongFormPostUseCase,
} from "~/features/posts/server/longform";
import { prisma } from "~/lib/prisma.server";
import { fromDate } from "~/lib/temporal";

// Skip if no test database configured
const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const SHOULD_SKIP_DB_TESTS = process.env["SKIP_DATABASE_TESTS"] === "true";

describe.skipIf(!TEST_DATABASE_URL || SHOULD_SKIP_DB_TESTS)(
  "ScheduleLongFormPostUseCase Integration",
  () => {
    let userId: string;
    let useCase: ScheduleLongFormPostUseCase;

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
      useCase = new ScheduleLongFormPostUseCase();
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

    it("should schedule a longform post successfully", async () => {
      // Create a draft longform post
      const createUseCase = new CreateLongFormPostUseCase();
      const createResult = await createUseCase.execute({
        userId,
        title: "Test Title",
        content: "Test content",
      });

      const postId = createResult.post.id;

      // Schedule the post
      const scheduledAtUtc = fromDate(new Date(Date.now() + 3600000), "UTC"); // 1 hour from now
      await useCase.execute({
        postId,
        userId,
        scheduledAtUtc,
        signedEvent: {
          id: "test-event-id",
          pubkey: "test-pubkey",
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: "test",
          tags: [],
          sig: "test-sig",
        },
      });

      // Verify post is scheduled
      const scheduledPost = await prisma.longFormPost.findUnique({
        where: { id: postId },
      });
      const { deriveIsScheduledLongForm } =
        await import("~/features/posts/longform/state-machine/longform-post-state");
      expect(deriveIsScheduledLongForm(scheduledPost?.currentState)).toBe(true);
      // scheduledAtUtc is stored as Date in database, compare as Date objects
      expect(scheduledPost?.scheduledAtUtc).toBeInstanceOf(Date);
      if (scheduledPost?.scheduledAtUtc) {
        const expectedDate = new Date(
          scheduledAtUtc.toInstant().epochMilliseconds
        );
        // Allow small difference due to database precision
        expect(
          Math.abs(
            scheduledPost.scheduledAtUtc.getTime() - expectedDate.getTime()
          )
        ).toBeLessThan(1000);
      }

      // Verify outbox event was created
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: postId,
          eventType: "LONGFORM_SCHEDULED",
        },
      });
      expect(outboxEvents.length).toBe(1);
    });

    it("should throw error if post not found", async () => {
      await expect(
        useCase.execute({
          postId: "non-existent-post-id",
          userId,
          scheduledAtUtc: fromDate(new Date(), "UTC"),
          signedEvent: {
            id: "test-event-id",
            pubkey: "test-pubkey",
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            content: "test",
            tags: [],
            sig: "test-sig",
          },
        })
      ).rejects.toThrow("not found for user");
    });
  }
);
