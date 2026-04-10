-- Strict persisted plan ID cutover:
--   basic   -> creator
--   premium -> pro
--
-- This migration intentionally removes legacy persisted IDs with no
-- compatibility layer in database values.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Plan" WHERE id = 'creator')
     AND EXISTS (SELECT 1 FROM "Plan" WHERE id = 'basic') THEN
    RAISE EXCEPTION 'Cannot rename basic->creator because creator already exists';
  END IF;

  IF EXISTS (SELECT 1 FROM "Plan" WHERE id = 'pro')
     AND EXISTS (SELECT 1 FROM "Plan" WHERE id = 'premium') THEN
    RAISE EXCEPTION 'Cannot rename premium->pro because pro already exists';
  END IF;
END $$;

-- FK targets use ON UPDATE CASCADE, so Subscription.planId and PlanPrice.planId
-- follow these primary-key updates.
UPDATE "Plan" SET id = 'creator' WHERE id = 'basic';
UPDATE "Plan" SET id = 'pro' WHERE id = 'premium';

-- Denormalized / non-FK plan references that must be explicitly rewritten.
UPDATE "Subscription"
SET "plan" = 'creator'
WHERE "plan" = 'basic';

UPDATE "Subscription"
SET "plan" = 'pro'
WHERE "plan" = 'premium';

UPDATE "SubscriptionNotificationAttempt"
SET "planId" = 'creator'
WHERE "planId" = 'basic';

UPDATE "SubscriptionNotificationAttempt"
SET "planId" = 'pro'
WHERE "planId" = 'premium';

UPDATE "Subscription"
SET "metadata" = jsonb_set("metadata"::jsonb, '{scheduledPlanId}', '"creator"', false)
WHERE "metadata" IS NOT NULL
  AND "metadata"::jsonb ->> 'scheduledPlanId' = 'basic';

UPDATE "Subscription"
SET "metadata" = jsonb_set("metadata"::jsonb, '{scheduledPlanId}', '"pro"', false)
WHERE "metadata" IS NOT NULL
  AND "metadata"::jsonb ->> 'scheduledPlanId' = 'premium';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Plan" WHERE id IN ('basic', 'premium')) THEN
    RAISE EXCEPTION 'Legacy IDs still present in Plan';
  END IF;

  IF EXISTS (SELECT 1 FROM "PlanPrice" WHERE "planId" IN ('basic', 'premium')) THEN
    RAISE EXCEPTION 'Legacy IDs still present in PlanPrice.planId';
  END IF;

  IF EXISTS (SELECT 1 FROM "Subscription" WHERE "planId" IN ('basic', 'premium')) THEN
    RAISE EXCEPTION 'Legacy IDs still present in Subscription.planId';
  END IF;

  IF EXISTS (SELECT 1 FROM "Subscription" WHERE "plan" IN ('basic', 'premium')) THEN
    RAISE EXCEPTION 'Legacy IDs still present in Subscription.plan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubscriptionNotificationAttempt"
    WHERE "planId" IN ('basic', 'premium')
  ) THEN
    RAISE EXCEPTION 'Legacy IDs still present in SubscriptionNotificationAttempt.planId';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Subscription"
    WHERE "metadata" IS NOT NULL
      AND "metadata"::jsonb ->> 'scheduledPlanId' IN ('basic', 'premium')
  ) THEN
    RAISE EXCEPTION 'Legacy IDs still present in Subscription.metadata.scheduledPlanId';
  END IF;
END $$;
