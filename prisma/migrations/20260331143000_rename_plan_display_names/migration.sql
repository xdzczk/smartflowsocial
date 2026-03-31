-- Rename plan display names to match the commercial ladder.
-- IDs remain stable for billing/gating (basic/premium/etc).

UPDATE "Plan"
SET "name" = 'Creator'
WHERE id = 'basic';

UPDATE "Plan"
SET "name" = 'Pro'
WHERE id = 'premium';

