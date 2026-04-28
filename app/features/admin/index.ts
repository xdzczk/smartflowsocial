/**
 * Public exports for admin UI (routes import from here per import/no-restricted-paths).
 */

export { AdminCurrencyProvider, useAdminCurrency } from "./admin-currency";
export type { AdminDisplayUnit } from "./format-admin-money";
export { ADMIN_DISPLAY_UNITS } from "./format-admin-money";
export {
  AdminAlertSeverityPill,
  AdminStatusPill,
} from "./components/AdminStatusPill";
export type { AdminHealthTone } from "./components/AdminStatusPill";
export { AdminAccessDenied } from "./components/AdminAccessDenied";
export { AdminAlertList } from "./components/AdminAlertList";
export { AdminCard } from "./components/AdminCard";
export type { AdminCardVariant } from "./components/AdminCard";
export { AdminChartCard } from "./components/AdminChartCard";
export {
  AdminDataTable,
  AdminDataTableEmpty,
  AdminDataTableHead,
} from "./components/AdminDataTable";
export { AdminLineChart, formatChartDayLabel } from "./components/admin-charts";
export type { AdminLineSeries } from "./components/admin-charts";
export {
  AdminMetricTitleRow,
  AdminMetricValue,
} from "./components/AdminMetricValue";
export { AdminPageHeader } from "./components/AdminPageHeader";
export { AdminProofOfWorkSection } from "./components/AdminProofOfWorkSection";
export { AdminSection } from "./components/AdminSection";
export { AdminTabNav } from "./components/AdminTabNav";
export { MetricCard } from "./components/MetricCard";
export {
  formatAdminDeltaPercent,
  formatAdminInteger,
} from "./metrics/format-admin";
export {
  getMetricDefinition,
  METRIC_DEFINITIONS,
  type MetricRegistryKey,
} from "./metrics/registry";
export type {
  MetricConfidence,
  MetricDefinition,
  ResolvedMetric,
} from "./metrics/metric-types";
export {
  confidenceForCount,
  confidenceForRate,
} from "./metrics/resolve-confidence";
export { AdminOperationsPageInner } from "./components/operations/AdminOperationsPageInner";
export { AdminAnalyticsPageSkeleton } from "./components/AdminAnalyticsPageSkeleton";
export { AdminOperationsPageSkeleton } from "./components/AdminOperationsPageSkeleton";
export { AdminUsersPageSkeleton } from "./components/AdminUsersPageSkeleton";
