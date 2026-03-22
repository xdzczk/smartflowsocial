import type { MetricDefinition } from "./metric-types";

const ALL_PRESETS = ["24h", "7d", "30d", "90d", "all"] as const;

export const METRIC_DEFINITIONS = {
  mrr_sats: {
    key: "mrr_sats",
    label: "MRR (sats)",
    description:
      "Monthly recurring revenue in satoshis: sum of last paid period amounts for active paid subscriptions (30-day billing).",
    formula:
      "SUM(Subscription.amountSats) for status ACTIVE and planId ≠ free.",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: false,
    minSampleForRate: 1,
    format: "sats",
    domain: "business",
    rangeSemantics: "fixed_window",
  },
  arr_run_rate_sats: {
    key: "arr_run_rate_sats",
    label: "ARR run-rate (sats)",
    description:
      "Twelve times current MRR (sats), a run-rate not GAAP revenue.",
    formula: "MRR (sats) × 12",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: false,
    minSampleForRate: 1,
    format: "sats",
    domain: "business",
    rangeSemantics: "fixed_window",
  },
  active_paid_subscribers: {
    key: "active_paid_subscribers",
    label: "Active paid subscribers",
    description: "Subscriptions ACTIVE with a paid plan (not built-in free).",
    formula: "COUNT(Subscription) WHERE status ACTIVE AND planId ≠ free",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: true,
    minSampleForRate: 20,
    format: "count",
    domain: "business",
    rangeSemantics: "range_sensitive",
  },
  net_paid_subscriber_change: {
    key: "net_paid_subscriber_change",
    label: "Net paid subscriber change",
    description:
      "Change in active paid subscriber count vs the prior period of equal length.",
    formula:
      "active_paid(now) − active_paid(prev_window_start snapshot approximated vs prior count)",
    allowedRangePresets: ["24h", "7d", "30d", "90d"],
    supportsPriorDelta: false,
    minSampleForRate: 10,
    format: "count",
    domain: "business",
    rangeSemantics: "range_sensitive",
  },
  publish_success_rate: {
    key: "publish_success_rate",
    label: "Publish success rate",
    description:
      "Published posts ÷ (published + newly failed) with timestamps in range.",
    formula: "published / (published + failed) short+long in range",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: true,
    minSampleForRate: 20,
    format: "percent",
    domain: "publishing",
    rangeSemantics: "range_sensitive",
  },
  users_nip46_profile: {
    key: "users_nip46_profile",
    label: "Users with remote signer profile",
    description:
      "Users whose stored primarySignerProfile is a valid NIP-46 config (proxy for remote signer).",
    formula: "COUNT(User) WHERE primarySignerProfile matches nip46 shape",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: false,
    minSampleForRate: 1,
    format: "count",
    domain: "signer",
    rangeSemantics: "range_sensitive",
  },
  users_extension_proxy: {
    key: "users_extension_proxy",
    label: "Users without NIP-46 profile (extension / other)",
    description:
      "Enabled users without a persisted NIP-46 primary profile (includes extension users and unset).",
    formula: "enabled users − nip46 profile users",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: false,
    minSampleForRate: 1,
    format: "count",
    domain: "signer",
    rangeSemantics: "range_sensitive",
  },
  signer_reconnect_failures: {
    key: "signer_reconnect_failures",
    label: "Signer reconnect failures",
    description:
      "Failed background NIP-46 reconnect attempts recorded in the selected range.",
    formula: "COUNT(SignerReconnectEvent) WHERE success = false",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: true,
    minSampleForRate: 10,
    format: "count",
    domain: "signer",
    rangeSemantics: "range_sensitive",
  },
  dau: {
    key: "dau",
    label: "DAU",
    description:
      "Distinct users with product session activity per UTC day (last 1d).",
    formula:
      "COUNT DISTINCT userId FROM ProductSession WHERE lastActivity in window",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: true,
    minSampleForRate: 15,
    format: "count",
    domain: "product",
    rangeSemantics: "range_sensitive",
  },
  wau: {
    key: "wau",
    label: "WAU",
    description: "Distinct users with session activity in the last 7 UTC days.",
    formula: "COUNT DISTINCT userId FROM ProductSession in 7d",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: true,
    minSampleForRate: 15,
    format: "count",
    domain: "product",
    rangeSemantics: "range_sensitive",
  },
  mau: {
    key: "mau",
    label: "MAU",
    description:
      "Distinct users with session activity in the last 30 UTC days.",
    formula: "COUNT DISTINCT userId FROM ProductSession in 30d",
    allowedRangePresets: ALL_PRESETS,
    supportsPriorDelta: true,
    minSampleForRate: 15,
    format: "count",
    domain: "product",
    rangeSemantics: "range_sensitive",
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricRegistryKey = keyof typeof METRIC_DEFINITIONS;

export function getMetricDefinition(key: MetricRegistryKey): MetricDefinition {
  return METRIC_DEFINITIONS[key];
}
