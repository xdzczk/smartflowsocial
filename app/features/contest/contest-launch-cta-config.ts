/** Source × launch mode → primary CTA label and bottom outcome sentence (spec §16). */
export const contestLaunchActionConfig = {
  existing_now: {
    ctaLabel: "Launch contest now",
    outcomeText:
      "This will launch the contest immediately using the selected published post.",
  },
  existing_schedule: {
    ctaLabel: "Schedule contest",
    outcomeText:
      "This will schedule the contest to start at the selected time using the selected published post.",
  },
  new_now: {
    ctaLabel: "Publish post & launch contest",
    outcomeText:
      "This will publish the source post now, then launch the contest.",
  },
  new_schedule: {
    ctaLabel: "Schedule post & contest",
    outcomeText:
      "This will schedule the source post and contest launch for the selected time.",
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
