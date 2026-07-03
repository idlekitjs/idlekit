/**
 * In-house big-number type for incremental games, replacing `break_infinity.js`.
 *
 * A value is represented as `mantissa * 10^exponent` where the mantissa is a
 * normalized float in `[1, 10)` (or exactly 0) and the exponent is an integer
 * carried as a plain JS number. This keeps ~16 significant digits (a double's
 * worth) while the exponent extends the range far beyond `Number.MAX_VALUE`
 * (up to about `10^(1.8e308)`), which is exactly the trade-off idle games need.
 *
 * Instances are immutable: every operation returns a new `Decimal`.
 *
 * Known limits (acceptable for the genre):
 * - precision is that of a double (~16 significant digits), not arbitrary;
 * - `toNumber()` overflows to `Infinity` for exponents beyond ~308 even though
 *   the `Decimal` itself stays finite.
 */
export type DecimalSource = Decimal | number | string;

/** Above this exponent gap, the smaller operand is negligible in an addition. */
const MAX_SIGNIFICANT_DIGITS = 17;
/** At or above this exponent, a value has no fractional part (it is an integer). */
const INTEGER_EXPONENT = 16;

/** Bring `mantissa * 10^exponent` into the canonical form (mantissa in [1, 10)). */
function normalizeComponents(mantissa: number, exponent: number): [number, number] {
  if (mantissa === 0) {
    return [0, 0];
  }
  if (!Number.isFinite(mantissa)) {
    return [mantissa, 0];
  }
  const sign = mantissa < 0 ? -1 : 1;
  const abs = Math.abs(mantissa);
  let shift = Math.floor(Math.log10(abs));
  let scaled = abs / Math.pow(10, shift);
  // Round to a double's worth of significant digits, clearing the float noise
  // operations accumulate (e.g. 1.0240000000000002 -> 1.024 so 2^10 is exact).
  scaled = Number(scaled.toPrecision(15));
  // Correct any off-by-one from log10 rounding at powers of ten.
  if (scaled >= 10) {
    scaled /= 10;
    shift += 1;
  } else if (scaled < 1) {
    scaled *= 10;
    shift -= 1;
  }
  return [sign * scaled, exponent + shift];
}

function fromNumber(value: number): [number, number] {
  if (value === 0) {
    return [0, 0];
  }
  if (!Number.isFinite(value)) {
    return [value, 0];
  }
  return normalizeComponents(value, 0);
}

const STRING_PATTERN = /^([+-]?)(\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

function fromString(value: string): [number, number] {
  const str = value.trim();
  if (str === "" || str === "0") {
    return [0, 0];
  }
  if (str === "Infinity" || str === "+Infinity") return [Infinity, 0];
  if (str === "-Infinity") return [-Infinity, 0];

  const match = STRING_PATTERN.exec(str);
  if (!match) {
    return [NaN, 0];
  }
  const sign = match[1] === "-" ? -1 : 1;
  const intPart = match[2] || "0";
  const fracPart = match[3] || "";
  const expPart = match[4] ? parseInt(match[4], 10) : 0;
  const mantissaNum = Number(`${intPart}.${fracPart || "0"}`);
  if (mantissaNum === 0) {
    return [0, 0];
  }
  return normalizeComponents(sign * mantissaNum, expPart);
}

export class Decimal {
  /** Mantissa, normalized to `[1, 10)` (or exactly 0). */
  readonly mantissa: number;
  /** Base-10 exponent (a plain integer). */
  readonly exponent: number;

  constructor(value: DecimalSource = 0) {
    let parsed: [number, number];
    if (value instanceof Decimal) {
      parsed = [value.mantissa, value.exponent];
    } else if (typeof value === "number") {
      parsed = fromNumber(value);
    } else {
      parsed = fromString(String(value));
    }
    this.mantissa = parsed[0];
    this.exponent = parsed[1];
  }

  /** Build a normalized instance from raw components (internal fast path). */
  private static build(mantissa: number, exponent: number): Decimal {
    const [m, e] = normalizeComponents(mantissa, exponent);
    // Object.create avoids the parse/normalize round-trip of the public ctor.
    const d = Object.create(Decimal.prototype) as { mantissa: number; exponent: number };
    d.mantissa = m;
    d.exponent = e;
    return d as unknown as Decimal;
  }

  private static coerce(value: DecimalSource): Decimal {
    return value instanceof Decimal ? value : new Decimal(value);
  }

  // --- Arithmetic ---------------------------------------------------------

  add(value: DecimalSource): Decimal {
    const other = Decimal.coerce(value);
    if (!this.isFinite() || !other.isFinite()) {
      return Decimal.build(this.toNumber() + other.toNumber(), 0);
    }
    if (this.mantissa === 0) return other;
    if (other.mantissa === 0) return this;

    const [big, small] = this.exponent >= other.exponent ? [this, other] : [other, this];
    const diff = big.exponent - small.exponent;
    if (diff > MAX_SIGNIFICANT_DIGITS) {
      return big;
    }
    const combined = big.mantissa + small.mantissa / Math.pow(10, diff);
    return Decimal.build(combined, big.exponent);
  }

  sub(value: DecimalSource): Decimal {
    return this.add(Decimal.coerce(value).neg());
  }

  mul(value: DecimalSource): Decimal {
    const other = Decimal.coerce(value);
    return Decimal.build(this.mantissa * other.mantissa, this.exponent + other.exponent);
  }

  div(value: DecimalSource): Decimal {
    const other = Decimal.coerce(value);
    if (other.mantissa === 0) {
      const sign = this.mantissa < 0 ? -1 : 1;
      return Decimal.build(this.mantissa === 0 ? NaN : sign * Infinity, 0);
    }
    return Decimal.build(this.mantissa / other.mantissa, this.exponent - other.exponent);
  }

  neg(): Decimal {
    return Decimal.build(-this.mantissa, this.exponent);
  }

  abs(): Decimal {
    return Decimal.build(Math.abs(this.mantissa), this.exponent);
  }

  recip(): Decimal {
    return new Decimal(1).div(this);
  }

  // --- Powers & logarithms ------------------------------------------------

  /** Raise to a `number` power. Integer powers are exact (squaring); fractional powers go through logarithms. */
  pow(n: number): Decimal {
    if (n === 0) return new Decimal(1);
    if (n === 1) return this;
    if (this.mantissa === 0) return n > 0 ? new Decimal(0) : Decimal.build(Infinity, 0);

    if (Number.isInteger(n)) {
      const negative = n < 0;
      let exp = Math.abs(n);
      let result = new Decimal(1);
      let base = Decimal.build(this.mantissa, this.exponent);
      while (exp > 0) {
        if (exp % 2 === 1) {
          result = result.mul(base);
        }
        exp = Math.floor(exp / 2);
        if (exp > 0) {
          base = base.mul(base);
        }
      }
      return negative ? result.recip() : result;
    }

    if (this.mantissa < 0) {
      return Decimal.build(NaN, 0);
    }
    const log = n * this.log10();
    const exponent = Math.floor(log);
    return Decimal.build(Math.pow(10, log - exponent), exponent);
  }

  /** Base-10 logarithm, returned as a plain `number`. */
  log10(): number {
    if (this.mantissa === 0) return -Infinity;
    if (this.mantissa < 0) return NaN;
    return Math.log10(this.mantissa) + this.exponent;
  }

  /** Natural logarithm, returned as a plain `number`. */
  ln(): number {
    return this.log10() * Math.LN10;
  }

  /** Logarithm in an arbitrary base, returned as a plain `number`. */
  log(base: number): number {
    return this.log10() / Math.log10(base);
  }

  // --- Comparison ---------------------------------------------------------

  /** Returns -1, 0 or 1. */
  cmp(value: DecimalSource): number {
    const other = Decimal.coerce(value);
    if (this.mantissa === 0 && other.mantissa === 0) return 0;
    if (this.mantissa === 0) return other.mantissa > 0 ? -1 : 1;
    if (other.mantissa === 0) return this.mantissa > 0 ? 1 : -1;

    const sign = Math.sign(this.mantissa);
    if (sign !== Math.sign(other.mantissa)) {
      return sign > 0 ? 1 : -1;
    }
    if (this.exponent !== other.exponent) {
      return (this.exponent > other.exponent ? 1 : -1) * sign;
    }
    if (this.mantissa !== other.mantissa) {
      return this.mantissa > other.mantissa ? 1 : -1;
    }
    return 0;
  }

  eq(value: DecimalSource): boolean {
    return this.cmp(value) === 0;
  }

  neq(value: DecimalSource): boolean {
    return this.cmp(value) !== 0;
  }

  lt(value: DecimalSource): boolean {
    return this.cmp(value) < 0;
  }

  lte(value: DecimalSource): boolean {
    return this.cmp(value) <= 0;
  }

  gt(value: DecimalSource): boolean {
    return this.cmp(value) > 0;
  }

  gte(value: DecimalSource): boolean {
    return this.cmp(value) >= 0;
  }

  max(value: DecimalSource): Decimal {
    return this.gte(value) ? this : Decimal.coerce(value);
  }

  min(value: DecimalSource): Decimal {
    return this.lte(value) ? this : Decimal.coerce(value);
  }

  static max(a: DecimalSource, b: DecimalSource): Decimal {
    return Decimal.coerce(a).max(b);
  }

  static min(a: DecimalSource, b: DecimalSource): Decimal {
    return Decimal.coerce(a).min(b);
  }

  // --- Rounding -----------------------------------------------------------

  floor(): Decimal {
    if (this.isInteger()) return this;
    return new Decimal(Math.floor(this.toNumber()));
  }

  ceil(): Decimal {
    if (this.isInteger()) return this;
    return new Decimal(Math.ceil(this.toNumber()));
  }

  round(): Decimal {
    if (this.isInteger()) return this;
    return new Decimal(Math.round(this.toNumber()));
  }

  trunc(): Decimal {
    if (this.isInteger()) return this;
    return new Decimal(Math.trunc(this.toNumber()));
  }

  private isInteger(): boolean {
    return this.mantissa === 0 || !this.isFinite() || this.exponent >= INTEGER_EXPONENT;
  }

  // --- Predicates ---------------------------------------------------------

  isZero(): boolean {
    return this.mantissa === 0;
  }

  isFinite(): boolean {
    return Number.isFinite(this.mantissa);
  }

  isNaN(): boolean {
    return Number.isNaN(this.mantissa);
  }

  isPositive(): boolean {
    return this.mantissa > 0;
  }

  isNegative(): boolean {
    return this.mantissa < 0;
  }

  // --- Conversions --------------------------------------------------------

  toNumber(): number {
    if (!Number.isFinite(this.mantissa)) return this.mantissa;
    if (this.mantissa === 0) return 0;
    if (this.exponent > 308) return this.mantissa > 0 ? Infinity : -Infinity;
    if (this.exponent < -324) return 0;
    // Going through a string yields a correctly-rounded result (e.g. exactly 12345).
    return Number(`${this.mantissa}e${this.exponent}`);
  }

  valueOf(): number {
    return this.toNumber();
  }

  toString(): string {
    if (!this.isFinite()) return String(this.mantissa);
    if (this.mantissa === 0) return "0";
    if (this.exponent >= 21 || this.exponent <= -7) {
      return `${this.mantissa}e${this.exponent >= 0 ? "+" : "-"}${Math.abs(this.exponent)}`;
    }
    return String(this.toNumber());
  }

  toExponential(fractionDigits = 2): string {
    if (!this.isFinite()) return String(this.mantissa);
    const sign = this.exponent >= 0 ? "+" : "-";
    return `${this.mantissa.toFixed(fractionDigits)}e${sign}${Math.abs(this.exponent)}`;
  }

  toFixed(fractionDigits = 0): string {
    if (!this.isFinite()) return String(this.mantissa);
    if (this.exponent > 20 || this.exponent < -20) {
      return this.toExponential(fractionDigits);
    }
    return this.toNumber().toFixed(fractionDigits);
  }

  /** Serializable form, parseable back via `new Decimal(...)`. */
  toJSON(): string {
    return this.toString();
  }
}

/** Concise factory: `D(5).mul(2)`. */
export function D(value: DecimalSource): Decimal {
  return new Decimal(value);
}
