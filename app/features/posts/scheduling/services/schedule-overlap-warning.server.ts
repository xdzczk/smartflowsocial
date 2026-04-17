import { findScheduledCandidatesNearTime } from "../repositories/schedule-overlap-warning-data.server";

const DEFAULT_PROXIMITY_MINUTES = 15;
const EXACT_MATCH_THRESHOLD_MS = 60_000;

interface ScheduledCandidate {
  id: string;
  scheduledAtUtc: Date;
  queueTypeId: string | null;
}

export interface ScheduleOverlapWarning {
  message: string;
  minutesApart: number;
  overlapsExactly: boolean;
  sameQueue: boolean;
  nearbyCount: number;
}

interface BuildScheduleOverlapWarningInput {
  targetScheduledAtUtc: Date;
  queueTypeId?: string | null;
  proximityMinutes?: number;
  candidates: ScheduledCandidate[];
}

interface CandidateWithDistance extends ScheduledCandidate {
  diffMs: number;
}

function toCandidateWithDistance(
  targetTimeMs: number,
  candidate: ScheduledCandidate
): CandidateWithDistance {
  return {
    ...candidate,
    diffMs: Math.abs(candidate.scheduledAtUtc.getTime() - targetTimeMs),
  };
}

function buildWarningMessage({
  nearest,
  overlapsExactly,
  minutesApart,
  proximityMinutes,
  nearbyCount,
}: {
  nearest: CandidateWithDistance;
  overlapsExactly: boolean;
  minutesApart: number;
  proximityMinutes: number;
  nearbyCount: number;
}): string {
  if (overlapsExactly) {
    const exactMessage = nearest.queueTypeId
      ? "Another item in this queue is already scheduled at this time."
      : "Another scheduled item is already set for this time.";
    return nearbyCount > 1
      ? `${exactMessage} ${nearbyCount} scheduled items are within ${proximityMinutes} minutes.`
      : exactMessage;
  }

  const nearMessage = nearest.queueTypeId
    ? `This time is ${minutesApart} min from another item in this queue.`
    : `This time is ${minutesApart} min from another scheduled item.`;

  return nearbyCount > 1
    ? `${nearMessage} ${nearbyCount} scheduled items are within ${proximityMinutes} minutes.`
    : nearMessage;
}

export function buildScheduleOverlapWarning({
  targetScheduledAtUtc,
  queueTypeId,
  proximityMinutes = DEFAULT_PROXIMITY_MINUTES,
  candidates,
}: BuildScheduleOverlapWarningInput): ScheduleOverlapWarning | null {
  const proximityMs = proximityMinutes * 60_000;
  const targetTimeMs = targetScheduledAtUtc.getTime();

  const nearbyCandidates = candidates
    .map((candidate) => toCandidateWithDistance(targetTimeMs, candidate))
    .filter((candidate) => candidate.diffMs <= proximityMs)
    .sort((a, b) => a.diffMs - b.diffMs);

  if (nearbyCandidates.length === 0) {
    return null;
  }

  const queueMatchedCandidates =
    queueTypeId === undefined
      ? []
      : nearbyCandidates.filter(
          (candidate) => candidate.queueTypeId === queueTypeId
        );

  const nearest = queueMatchedCandidates[0] ?? nearbyCandidates[0];

  if (!nearest) {
    return null;
  }

  const overlapsExactly = nearest.diffMs < EXACT_MATCH_THRESHOLD_MS;
  const minutesApart = overlapsExactly
    ? 0
    : Math.max(1, Math.round(nearest.diffMs / 60_000));
  const sameQueue =
    queueTypeId !== undefined && nearest.queueTypeId === queueTypeId;

  return {
    message: buildWarningMessage({
      nearest: {
        ...nearest,
        queueTypeId: sameQueue ? nearest.queueTypeId : null,
      },
      overlapsExactly,
      minutesApart,
      proximityMinutes,
      nearbyCount: nearbyCandidates.length,
    }),
    minutesApart,
    overlapsExactly,
    sameQueue,
    nearbyCount: nearbyCandidates.length,
  };
}

interface GetScheduleOverlapWarningInput {
  userId: string;
  targetScheduledAtUtc: Date;
  queueTypeId?: string | null;
  excludeContentId?: string | null;
  proximityMinutes?: number;
}

export async function getScheduleOverlapWarning({
  userId,
  targetScheduledAtUtc,
  queueTypeId,
  excludeContentId = null,
  proximityMinutes = DEFAULT_PROXIMITY_MINUTES,
}: GetScheduleOverlapWarningInput): Promise<ScheduleOverlapWarning | null> {
  const proximityMs = proximityMinutes * 60_000;
  const rangeStart = new Date(targetScheduledAtUtc.getTime() - proximityMs);
  const rangeEnd = new Date(targetScheduledAtUtc.getTime() + proximityMs);

  const allCandidates: ScheduledCandidate[] =
    await findScheduledCandidatesNearTime({
      userId,
      rangeStart,
      rangeEnd,
      excludeContentId,
    });

  return buildScheduleOverlapWarning({
    targetScheduledAtUtc,
    queueTypeId,
    proximityMinutes,
    candidates: allCandidates,
  });
}
