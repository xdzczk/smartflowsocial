import type { TrustScoreUser as User } from "./types";
// Re-export the User type
export type { TrustScoreUser as User } from "~/features/engagement/types";

/**
 * Calculates a trust score from 0-100 based on user data
 * Higher scores indicate more trustworthy/established profiles
 */
export function calculateTrustScore(user: User): number {
  let score = 0;
  let maxScore = 0;

  // 1. Profile Completeness (25 points max)
  // Having basic profile information shows investment in the account
  maxScore += 25;

  if (user.name) score += 5;
  if (user.displayName) score += 5;
  if (user.about && user.about.length > 20) score += 8; // Meaningful about section
  if (user.picture) score += 4;
  if (user.nip05) score += 3; // NIP-05 verification shows legitimacy

  // 2. Account Age (15 points max)
  // Older accounts are generally more trustworthy
  maxScore += 15;

  const accountAge = getAccountAgeInDays(user.timeJoined);
  if (accountAge > 365)
    score += 15; // 1+ years
  else if (accountAge > 180)
    score += 12; // 6+ months
  else if (accountAge > 90)
    score += 8; // 3+ months
  else if (accountAge > 30)
    score += 5; // 1+ month
  else if (accountAge > 7) score += 2; // 1+ week

  // 3. Social Engagement (30 points max)
  // Active participation indicates legitimate use
  maxScore += 30;

  // Followers (weighted logarithmically to prevent gaming)
  const followerScore = Math.min(
    12,
    Math.log10(Math.max(1, user.followersCount)) * 3,
  );
  score += followerScore;

  // Notes/Content creation
  const noteScore = Math.min(8, Math.log10(Math.max(1, user.noteCount)) * 2);
  score += noteScore;

  // Replies (shows engagement)
  const replyScore = Math.min(
    5,
    Math.log10(Math.max(1, user.replyCount)) * 1.5,
  );
  score += replyScore;

  // Balanced following ratio (not following too many or too few)
  const followRatio =
    user.followersCount > 0 ? user.followsCount / user.followersCount : 0;
  if (followRatio > 0.1 && followRatio < 10) score += 5; // Healthy follow ratio

  // 4. Economic Activity (20 points max)
  // Lightning and zap activity indicates real economic participation
  maxScore += 20;

  if (user.lud16) score += 5; // Lightning address shows economic participation

  // Zap activity (both sent and received)
  const zapScore = Math.min(10, Math.log10(Math.max(1, user.zapCount)) * 2.5);
  score += zapScore;

  // Total sats zapped (economic value)
  const satsScore = Math.min(
    5,
    Math.log10(Math.max(1, user.totalSatsZapped)) * 1,
  );
  score += satsScore;

  // 5. Content Diversity (10 points max)
  // Varied content types suggest authentic usage
  maxScore += 10;

  if (user.mediaCount > 0) score += 3; // Media posts
  if (user.replyCount > user.noteCount * 0.1) score += 3; // Engages with others
  if (user.noteCount > 10) score += 2; // Regular posting
  if (user.followersCount > user.noteCount * 0.5) score += 2; // Good content quality

  // Normalize to 0-100 scale
  const normalizedScore = Math.round((score / maxScore) * 100);

  // Cap at 100 and ensure minimum of 0
  return Math.min(100, Math.max(0, normalizedScore));
}

/**
 * Gets account age in days from timeJoined timestamp
 */
export function getAccountAgeInDays(timeJoined: number): number {
  if (timeJoined === 0) return 0;

  const joinedDate = new Date(timeJoined * 1000);
  const now = new Date();
  const diffInMs = now.getTime() - joinedDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffInDays);
}

/**
 * Gets a trust level description based on score
 */
export function getTrustLevel(score: number): {
  level: string;
  color: string;
  description: string;
} {
  if (score >= 80) {
    return {
      level: "Highly Trusted",
      color: "text-green-600 dark:text-green-400",
      description: "Well-established profile with strong community engagement",
    };
  } else if (score >= 60) {
    return {
      level: "Trusted",
      color: "text-blue-600 dark:text-blue-400",
      description: "Active profile with good community standing",
    };
  } else if (score >= 40) {
    return {
      level: "Developing",
      color: "text-yellow-600 dark:text-yellow-400",
      description: "Growing profile building community presence",
    };
  } else if (score >= 20) {
    return {
      level: "New",
      color: "text-orange-600 dark:text-orange-400",
      description: "Recently created or limited activity profile",
    };
  } else {
    return {
      level: "Unverified",
      color: "text-gray-600 dark:text-gray-400",
      description: "Minimal profile information or activity",
    };
  }
}

/**
 * Gets trust score badge color classes
 */
export function getTrustScoreBadgeColor(score: number): string {
  if (score >= 80) {
    return "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800";
  } else if (score >= 60) {
    return "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800";
  } else if (score >= 40) {
    return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800";
  } else if (score >= 20) {
    return "bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800";
  } else {
    return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700";
  }
}
