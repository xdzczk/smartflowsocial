/** Source × launch mode → primary CTA label and bottom outcome sentence (spec §16). */
export const contestLaunchActionConfig = {
  existing_now: {
    ctaLabel: "Launch contest now",
    outcomeText: "Launches on the selected post immediately.",
  },
  existing_schedule: {
    ctaLabel: "Schedule contest",
    outcomeText: "Starts the contest at the scheduled time on that post.",
  },
  new_now: {
    ctaLabel: "Publish post & launch contest",
    outcomeText: "Publishes the source post now, then launches the contest.",
  },
  new_schedule: {
    ctaLabel: "Schedule post & contest",
    outcomeText:
      "Publishes the source post and starts the contest at the scheduled time.",
  },
} as const;

export type ContestLaunchCtaKey = keyof typeof contestLaunchActionConfig;

export function getContestLaunchCtaKey(
  sourceMode: "create" | "existing",
  launchMode: "now" | "schedule"
): ContestLaunchCtaKey {
  if (sourceMode === "existing") {
    return launchMode === "now" ? "existing_now" : "existing_schedule";
  }
  return launchMode === "now" ? "new_now" : "new_schedule";
}

export function getContestLaunchCtaConfig(
  sourceMode: "create" | "existing",
  launchMode: "now" | "schedule"
): (typeof contestLaunchActionConfig)[ContestLaunchCtaKey] {
  return contestLaunchActionConfig[
    getContestLaunchCtaKey(sourceMode, launchMode)
  ];
}
