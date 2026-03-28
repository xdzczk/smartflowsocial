-- Expand EngagementItemState workflow model for Engagement Feed v2 (enum labels only).
-- PostgreSQL does not allow using a new enum value in the same transaction as ALTER TYPE ...
-- ADD VALUE (55P04). Prisma runs one migration = one transaction, so data/DDL that uses
-- these labels lives in 20260328140000_engagement_feed_v2_backfill_and_linked_action.
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'UNHANDLED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'DRAFTED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'REPLIED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'IGNORED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'SNOOZED';
