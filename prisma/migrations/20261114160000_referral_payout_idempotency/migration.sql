-- Claim token for in-flight referral earnings, and a unique payment hash
-- so the same BOLT11 invoice cannot be submitted twice.
ALTER TABLE "ReferralEarning" ADD COLUMN "payout_claim_hash" TEXT;

ALTER TABLE "referral_payout_audit_log" ADD COLUMN "payment_hash" TEXT;

CREATE UNIQUE INDEX "referral_payout_audit_log_payment_hash_key"
  ON "referral_payout_audit_log"("payment_hash");
