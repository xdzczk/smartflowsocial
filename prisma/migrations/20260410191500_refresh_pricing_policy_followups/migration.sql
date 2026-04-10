-- Pricing/plan-policy follow-up migration
-- - Add/refresh Starter recurring plan
-- - Update Creator/Pro/Founder prices
-- - Ensure yearly = 10x monthly for recurring tiers
-- - Hide Teams from pricing UI while preserving row for legacy/internal usage

-- Normalize existing plan rows
UPDATE "Plan"
SET
  name = 'Creator',
  price = 7,
  "sortOrder" = 30,
  "planBillingModel" = 'recurring',
  "purchasable" = true,
  "visibleOnPricingPage" = true,
  "isComingSoon" = false,
  "isSpecialOffering" = false,
  "founderSeatCap" = NULL,
  "updatedAt" = now()
WHERE id = 'basic';

UPDATE "Plan"
SET
  name = 'Pro',
  price = 17,
  "sortOrder" = 40,
  "planBillingModel" = 'recurring',
  "purchasable" = true,
  "visibleOnPricingPage" = true,
  "isComingSoon" = false,
  "isSpecialOffering" = false,
  "founderSeatCap" = NULL,
  "updatedAt" = now()
WHERE id = 'premium';

UPDATE "Plan"
SET
  name = 'Founder',
  price = 899,
  "sortOrder" = 100,
  "planBillingModel" = 'lifetime',
  "purchasable" = true,
  "visibleOnPricingPage" = true,
  "isComingSoon" = false,
  "isSpecialOffering" = true,
  "founderSeatCap" = COALESCE("founderSeatCap", 21),
  "updatedAt" = now()
WHERE id = 'founder';

UPDATE "Plan"
SET
  name = 'Teams',
  "sortOrder" = 50,
  "planBillingModel" = 'disabled',
  "purchasable" = false,
  "visibleOnPricingPage" = false,
  "isComingSoon" = true,
  "updatedAt" = now()
WHERE id = 'teams';

-- Insert or refresh Starter
INSERT INTO "Plan" (
  id,
  name,
  price,
  description,
  features,
  "maxPostsPerMonth",
  "maxQueueTypes",
  "maxTemplates",
  "maxLongFormPosts",
  "isActive",
  "sortOrder",
  "planBillingModel",
  "purchasable",
  "visibleOnPricingPage",
  "isComingSoon",
  "isSpecialOffering",
  "founderSeatCap",
  "enableAdvancedAnalytics",
  "enableBasicScheduling",
  "enableBulkScheduling",
  "enableCommissions",
  "enableEngagementFeed",
  "enableGiveaways",
  "enableContests",
  "enableLeaderboards",
  "enableLifetimeAccess",
  "enableMultiAccountSwitching",
  "enableMultipleQueues",
  "enableNativeS3BlossomStorage",
  "enableRelayBlast",
  "enableRepostsAndQuotes",
  "enableVisualPerks",
  "enableWolfFilteringAndVortex",
  "createdAt",
  "updatedAt"
)
VALUES (
  'starter',
  'Starter',
  4,
  'Start running consistent paid workflows',
  '{
    "basicScheduling": true,
    "multipleQueues": true,
    "bulkScheduling": true,
    "repostsAndQuotes": true,
    "engagementFeed": true,
    "giveaways": true,
    "commissions": "Medium",
    "leaderboards": true,
    "advancedAnalytics": false,
    "multiAccountSwitching": false,
    "wolfFilteringAndVortex": "Basic",
    "nativeS3BlossomStorage": true,
    "relayBlast": false,
    "visualPerks": false,
    "lifetimeAccess": false
  }'::jsonb,
  100,
  2,
  20,
  10,
  true,
  20,
  'recurring',
  true,
  true,
  false,
  false,
  NULL,
  false,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  true,
  false,
  true,
  false,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  "maxPostsPerMonth" = EXCLUDED."maxPostsPerMonth",
  "maxQueueTypes" = EXCLUDED."maxQueueTypes",
  "maxTemplates" = EXCLUDED."maxTemplates",
  "maxLongFormPosts" = EXCLUDED."maxLongFormPosts",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "planBillingModel" = EXCLUDED."planBillingModel",
  "purchasable" = EXCLUDED."purchasable",
  "visibleOnPricingPage" = EXCLUDED."visibleOnPricingPage",
  "isComingSoon" = EXCLUDED."isComingSoon",
  "isSpecialOffering" = EXCLUDED."isSpecialOffering",
  "founderSeatCap" = EXCLUDED."founderSeatCap",
  "enableAdvancedAnalytics" = EXCLUDED."enableAdvancedAnalytics",
  "enableBasicScheduling" = EXCLUDED."enableBasicScheduling",
  "enableBulkScheduling" = EXCLUDED."enableBulkScheduling",
  "enableCommissions" = EXCLUDED."enableCommissions",
  "enableEngagementFeed" = EXCLUDED."enableEngagementFeed",
  "enableGiveaways" = EXCLUDED."enableGiveaways",
  "enableContests" = EXCLUDED."enableContests",
  "enableLeaderboards" = EXCLUDED."enableLeaderboards",
  "enableLifetimeAccess" = EXCLUDED."enableLifetimeAccess",
  "enableMultiAccountSwitching" = EXCLUDED."enableMultiAccountSwitching",
  "enableMultipleQueues" = EXCLUDED."enableMultipleQueues",
  "enableNativeS3BlossomStorage" = EXCLUDED."enableNativeS3BlossomStorage",
  "enableRelayBlast" = EXCLUDED."enableRelayBlast",
  "enableRepostsAndQuotes" = EXCLUDED."enableRepostsAndQuotes",
  "enableVisualPerks" = EXCLUDED."enableVisualPerks",
  "enableWolfFilteringAndVortex" = EXCLUDED."enableWolfFilteringAndVortex",
  "updatedAt" = now();

-- Refresh recurring SKUs where yearly = 10x monthly
WITH recurring_prices(plan_id, billing_cadence, access_duration_months, payment_method, price_usd) AS (
  VALUES
    ('starter', 'monthly', 1, 'nwc_auto_renew', 4),
    ('starter', 'yearly', 12, 'nwc_auto_renew', 40),
    ('starter', 'monthly', 1, 'lightning_one_time', 4),
    ('starter', 'monthly', 3, 'lightning_one_time', 12),
    ('starter', 'monthly', 6, 'lightning_one_time', 24),
    ('starter', 'yearly', 12, 'lightning_one_time', 40),
    ('starter', 'yearly', 12, 'btc_btcpay_onchain', 40),
    ('basic', 'monthly', 1, 'nwc_auto_renew', 7),
    ('basic', 'yearly', 12, 'nwc_auto_renew', 70),
    ('basic', 'monthly', 1, 'lightning_one_time', 7),
    ('basic', 'monthly', 3, 'lightning_one_time', 21),
    ('basic', 'monthly', 6, 'lightning_one_time', 42),
    ('basic', 'yearly', 12, 'lightning_one_time', 70),
    ('basic', 'yearly', 12, 'btc_btcpay_onchain', 70),
    ('premium', 'monthly', 1, 'nwc_auto_renew', 17),
    ('premium', 'yearly', 12, 'nwc_auto_renew', 170),
    ('premium', 'monthly', 1, 'lightning_one_time', 17),
    ('premium', 'monthly', 3, 'lightning_one_time', 51),
    ('premium', 'monthly', 6, 'lightning_one_time', 102),
    ('premium', 'yearly', 12, 'lightning_one_time', 170),
    ('premium', 'yearly', 12, 'btc_btcpay_onchain', 170)
)
INSERT INTO "PlanPrice" (
  id,
  "planId",
  "billingCadence",
  "accessDurationMonths",
  "paymentMethod",
  "priceUsd",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(
    rp.plan_id || ':' || rp.billing_cadence || ':' || rp.access_duration_months::text || ':' || rp.payment_method
  ),
  rp.plan_id,
  rp.billing_cadence::"BillingCadence",
  rp.access_duration_months,
  rp.payment_method::"BillingPaymentMethod",
  rp.price_usd,
  true,
  now(),
  now()
FROM recurring_prices rp
ON CONFLICT ("planId", "billingCadence", "accessDurationMonths", "paymentMethod")
DO UPDATE SET
  "priceUsd" = EXCLUDED."priceUsd",
  "isActive" = true,
  "updatedAt" = now();

-- Deactivate unexpected SKUs for recurring plans in this pricing policy
WITH allowed(plan_id, billing_cadence, access_duration_months, payment_method) AS (
  VALUES
    ('starter', 'monthly', 1, 'nwc_auto_renew'),
    ('starter', 'yearly', 12, 'nwc_auto_renew'),
    ('starter', 'monthly', 1, 'lightning_one_time'),
    ('starter', 'monthly', 3, 'lightning_one_time'),
    ('starter', 'monthly', 6, 'lightning_one_time'),
    ('starter', 'yearly', 12, 'lightning_one_time'),
    ('starter', 'yearly', 12, 'btc_btcpay_onchain'),
    ('basic', 'monthly', 1, 'nwc_auto_renew'),
    ('basic', 'yearly', 12, 'nwc_auto_renew'),
    ('basic', 'monthly', 1, 'lightning_one_time'),
    ('basic', 'monthly', 3, 'lightning_one_time'),
    ('basic', 'monthly', 6, 'lightning_one_time'),
    ('basic', 'yearly', 12, 'lightning_one_time'),
    ('basic', 'yearly', 12, 'btc_btcpay_onchain'),
    ('premium', 'monthly', 1, 'nwc_auto_renew'),
    ('premium', 'yearly', 12, 'nwc_auto_renew'),
    ('premium', 'monthly', 1, 'lightning_one_time'),
    ('premium', 'monthly', 3, 'lightning_one_time'),
    ('premium', 'monthly', 6, 'lightning_one_time'),
    ('premium', 'yearly', 12, 'lightning_one_time'),
    ('premium', 'yearly', 12, 'btc_btcpay_onchain')
)
UPDATE "PlanPrice" pp
SET
  "isActive" = false,
  "updatedAt" = now()
WHERE
  pp."planId" IN ('starter', 'basic', 'premium')
  AND NOT EXISTS (
    SELECT 1
    FROM allowed a
    WHERE
      a.plan_id = pp."planId"
      AND a.billing_cadence::"BillingCadence" = pp."billingCadence"
      AND a.access_duration_months = pp."accessDurationMonths"
      AND a.payment_method::"BillingPaymentMethod" = pp."paymentMethod"
  );

-- Founder is one-time only at updated one-time price
UPDATE "PlanPrice"
SET
  "isActive" = false,
  "updatedAt" = now()
WHERE "planId" = 'founder';

INSERT INTO "PlanPrice" (
  id,
  "planId",
  "billingCadence",
  "accessDurationMonths",
  "paymentMethod",
  "priceUsd",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    md5('founder:yearly:12:lightning_one_time'),
    'founder',
    'yearly'::"BillingCadence",
    12,
    'lightning_one_time'::"BillingPaymentMethod",
    899,
    true,
    now(),
    now()
  ),
  (
    md5('founder:yearly:12:btc_btcpay_onchain'),
    'founder',
    'yearly'::"BillingCadence",
    12,
    'btc_btcpay_onchain'::"BillingPaymentMethod",
    899,
    true,
    now(),
    now()
  )
ON CONFLICT ("planId", "billingCadence", "accessDurationMonths", "paymentMethod")
DO UPDATE SET
  "priceUsd" = EXCLUDED."priceUsd",
  "isActive" = true,
  "updatedAt" = now();
