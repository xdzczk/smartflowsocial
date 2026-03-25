-- Payment term fields for v1.5 activation/renewal decisions

ALTER TABLE "Payment"
ADD COLUMN IF NOT EXISTS "billingCadence" "BillingCadence",
ADD COLUMN IF NOT EXISTS "accessDurationMonths" INTEGER,
ADD COLUMN IF NOT EXISTS "billingPaymentMethod" "BillingPaymentMethod";

