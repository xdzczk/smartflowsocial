/**
 * Append-only audit log for referral payouts (admin ledger).
 * Persistence lives in repositories; this module is the feature entry point.
 */

export {
  insertReferralPayoutAuditLog as createReferralPayoutAuditLog,
  listReferralPayoutAuditLogs,
} from "./repositories/referral-data.server";
