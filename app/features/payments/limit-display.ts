export function formatBytesForPlanMarketing(
  bytes: bigint | number | null
): string {
  if (bytes == null) return "—";
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "—";
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  if (n % GB === 0) return `${n / GB} GB`;
  if (n % MB === 0) return `${n / MB} MB`;
  const mb = Math.round((n / MB) * 10) / 10;
  return `${mb} MB`;
}
