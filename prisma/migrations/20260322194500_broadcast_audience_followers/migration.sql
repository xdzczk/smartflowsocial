-- Add FOLLOWERS audience (broadcast to accounts that follow you; resolved via Primal `user_followers`).
ALTER TYPE "BroadcastAudienceType" ADD VALUE 'FOLLOWERS';
