/**
 * Number formatting for display.
 */

/**
 * Idle-standard tier suffixes, indexed by power of a thousand: index 0 is `""`
 * (units), index 1 `"K"` (thousands), index 2 `"M"`, and so on. Shared by
 * {@link formatNumber} and {@link parseNumber} so both directions stay in sync —
 * do not redefine this list elsewhere. Exported read-only for introspection.
 */
export const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"] as const;

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

/**
 * Parse a human-authored amount back into a plain `number` — the inverse of
 * {@link formatNumber}. Handy for authoring large recipe/resource values, e.g.
 * `parseNumber("15Qi")` instead of `15_000_000_000_000_000_000`.
 *
 * Accepts:
 * - plain numbers: `"123"` -> `123`, `"1.5"` -> `1.5`;
 * - scientific notation (plain JS parsing): `"1.5e19"` -> `1.5e19`;
 * - compact suffix notation using the shared {@link SUFFIXES} table:
 *   `"1K"` -> `1000`, `"2.5M"` -> `2_500_000`, `"15Qi"` -> `1.5e19`.
 *
 * Surrounding whitespace is trimmed. Suffixes are matched case-sensitively
 * against {@link SUFFIXES} (`"1k"` is rejected). Custom suffixes and
 * locale-specific separators are not supported. The result is a plain `number`
 * (never a {@link Decimal}); values above `Number.MAX_SAFE_INTEGER` carry a
 * double's precision, which is the accepted trade-off for the genre.
 *
 * Throws on empty, malformed, or unknown-suffix input (matching core's style of
 * throwing on invalid arguments rather than returning `NaN`).
 */
export function parseNumber(value: string): number {
  const str = value.trim();
  if (str === "") {
    throw new Error("parseNumber: cannot parse an empty string.");
  }
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([A-Za-z]*)$/.exec(str);
  if (!match) {
    throw new Error(`parseNumber: "${value}" is not a valid number.`);
  }
  const mantissa = Number(match[1]);
  const suffix = match[2];
  if (suffix === "") {
    return mantissa;
  }
  const tier = (SUFFIXES as readonly string[]).indexOf(suffix);
  if (tier <= 0) {
    throw new Error(`parseNumber: unknown suffix "${suffix}" in "${value}".`);
  }
  return mantissa * Math.pow(1000, tier);
}

/**
 * Human-readable duration from **milliseconds**: `90000` -> `"1m 30s"`.
 *
 * Unit convention across IdleKit: simulation/mechanics durations (`dt`, `step`,
 * producer/timer/crafting/boost durations) are in **seconds**, while wall-clock
 * and browser/plugin options carry an explicit `Ms` suffix and are in
 * **milliseconds** (`offlineProgress.maxMs`, `autosave.intervalMs`,
 * `devtools.refreshMs`, the `resume` event). `formatDuration` takes
 * **milliseconds**, so convert seconds-domain values explicitly at the call
 * site (e.g. `formatDuration(seconds * 1000)`) until a seconds-domain formatter
 * is designed.
 */
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
