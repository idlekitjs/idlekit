/**
 * Number formatting for display.
 */
const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"] as const;

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Integer with thousands separators: `1234567` -> `"1,234,567"`. */
export function formatInteger(value: number): string {
  return integerFormatter.format(Math.floor(value));
}

/**
 * Compact number with a suffix: `1500` -> `"1.50K"`, `2.5e6` -> `"2.50M"`.
 * Beyond the known suffixes, falls back to scientific notation.
 */
export function formatNumber(value: number, decimals = 2): string {
  if (Number.isNaN(value)) {
    return "NaN";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "Infinity" : "-Infinity";
  }
  const abs = Math.abs(value);
  if (abs < 1000) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(decimals);
  }
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier < SUFFIXES.length) {
    const scaled = value / Math.pow(1000, tier);
    return `${scaled.toFixed(decimals)}${SUFFIXES[tier]}`;
  }
  return value.toExponential(decimals);
}

/** Human-readable duration from milliseconds: `90000` -> `"1m 30s"`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}
