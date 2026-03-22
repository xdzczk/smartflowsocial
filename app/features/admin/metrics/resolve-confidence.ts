import type { MetricConfidence } from "./metric-types";

/** Confidence for a proportion when sample size is small. */
export function confidenceForRate(
  successes: number,
  attempts: number
): {
  confidence: MetricConfidence;
  note?: string;
} {
  if (attempts <= 0) {
    return {
      confidence: "insufficient_sample",
      note: "No samples in this range.",
    };
  }
  if (attempts < 5) {
    return {
      confidence: "insufficient_sample",
      note: "Very few events — treat as directional only.",
    };
  }
  if (attempts < 20) {
    return {
      confidence: "directional",
      note: "Low sample — trend direction only.",
    };
  }
  return { confidence: "confident" };
}

export function confidenceForCount(
  n: number,
  lowThreshold = 8
): MetricConfidence {
  if (n < 3) return "insufficient_sample";
  if (n < lowThreshold) return "directional";
  return "confident";
}
