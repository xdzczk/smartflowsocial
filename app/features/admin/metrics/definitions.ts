/**
 * Metric definitions for operator admin (single source of truth for semantics).
 *
 * Active paid users: Subscription.status === ACTIVE and planId is not the built-in free plan (`free`).
 * New users in period: User.createdAt in [from, to).
 * Posts published (short): Post.currentState === PUBLISHED AND publishedAt in range.
 * Long-form published: LongFormPost.currentState === PUBLISHED AND publishedAt in range.
 * Publish success rate (period): published / (published + newly failed in period).
 *   "Newly failed" = Post updated to FAILED with updatedAt in range (approximation; excludes historical failures).
 * Active users (proxy): distinct userId with at least one short or long-form publish in range (publishedAt).
 * Pending payout sats: sum commissionSats where ReferralEarning.status === PENDING.
 */

export const PUBLISHING_STUCK_MINUTES = 30;
