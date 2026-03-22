/**
 * Shared admin metric model (registry + resolved values for loaders/UI).
 */

export type MetricDomain =
  | "business"
  | "product"
  | "signer"
  | "publishing"
  | "referral"
  | "infra";

export type MetricFormat =
  | "count"
  | "sats"
  | "currency"
  | "percent"
  | "duration";

/** How the metric behaves with time range selection (proof-of-work / exports). */
export type RangeSemantics =
  | "all_time"
  | "range_sensitive"
  | "fixed_window"
  | "hybrid";

export type MetricConfidence =
  | "confident"
  | "directional"
  | "insufficient_sample";

export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  /** Operator-facing formula / data sources. */
  formula: string;
  allowedRangePresets: readonly string[] | "all";
  /** Whether prior-period delta is meaningful for this metric. */
  supportsPriorDelta: boolean;
  minSampleForRate: number;
  format: MetricFormat;
  domain: MetricDomain;
  rangeSemantics: RangeSemantics;
}

export interface ResolvedMetric<T = number | string> {
  key: string;
  value: T;
  previous: T | null;
  deltaPct: number | null;
  confidence: MetricConfidence;
  confidenceNote?: string;
}
