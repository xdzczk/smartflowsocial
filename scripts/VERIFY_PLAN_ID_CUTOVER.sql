-- Pre/post verification queries for strict plan ID cutover.
-- Expected post-cutover legacy counts: 0.

SELECT 'Plan.id legacy' AS check_name, COUNT(*) AS legacy_count
FROM "Plan"
WHERE id IN ('basic', 'premium');

SELECT 'PlanPrice.planId legacy' AS check_name, COUNT(*) AS legacy_count
FROM "PlanPrice"
WHERE "planId" IN ('basic', 'premium');

SELECT 'Subscription.planId legacy' AS check_name, COUNT(*) AS legacy_count
FROM "Subscription"
WHERE "planId" IN ('basic', 'premium');

SELECT 'Subscription.plan legacy' AS check_name, COUNT(*) AS legacy_count
FROM "Subscription"
WHERE "plan" IN ('basic', 'premium');

SELECT 'SubscriptionNotificationAttempt.planId legacy' AS check_name, COUNT(*) AS legacy_count
FROM "SubscriptionNotificationAttempt"
WHERE "planId" IN ('basic', 'premium');

SELECT 'Subscription.metadata.scheduledPlanId legacy' AS check_name, COUNT(*) AS legacy_count
FROM "Subscription"
WHERE "metadata" IS NOT NULL
  AND "metadata"::jsonb ->> 'scheduledPlanId' IN ('basic', 'premium');

SELECT 'Canonical plan IDs present' AS check_name, array_agg(id ORDER BY id) AS plan_ids
FROM "Plan"
WHERE id IN ('free', 'starter', 'creator', 'pro', 'teams', 'founder');
