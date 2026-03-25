import { getContestById } from "./contest-actions.server";
import { createContestPreset } from "./contest-presets.server";
import type { ContestRankReward } from "./types";

export async function saveContestPresetFromDetailForm(
  userId: string,
  contestId: string,
  formData: FormData
): Promise<
  { success: true } | { success: false; error: string; status: number }
> {
  const nameRaw = formData.get("presetName");
  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return { success: false, error: "Preset name required", status: 400 };
  }
  const c = await getContestById(contestId, userId);
  if (!c) return { success: false, error: "Contest not found", status: 404 };
  try {
    await createContestPreset(userId, {
      name: nameRaw.trim(),
      title: c.title,
      rankingMetric: c.rankingMetric,
      prizeMode: c.prizeMode,
      winnerCount: c.winnerCount,
      equalRewardSats: c.equalRewardSats,
      rankRewards: (c.rankRewards as ContestRankReward[] | null) ?? null,
      fairnessConfig:
        (c.fairnessConfig as Record<string, unknown> | null) ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save preset";
    return { success: false, error: message, status: 400 };
  }
  return { success: true };
}
