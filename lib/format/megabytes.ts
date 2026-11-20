const BYTES_PER_MB = 1_000_000n;

/** バイト → MB の正確な10進表記(丸めない)。例: 20971520 → "20.97152" */
export function formatMegabytes(bytes: number | bigint) {
  const value = typeof bytes === "bigint" ? bytes : BigInt(Math.trunc(bytes));
  const whole = value / BYTES_PER_MB;
  const fraction = (value % BYTES_PER_MB).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** MB 表記(小数は6桁まで) → バイト。不正なら null */
export function parseMegabytes(value: string): bigint | null {
  const match = /^(\d{1,7})(?:\.(\d{1,6}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return BigInt(match[1]) * BYTES_PER_MB + BigInt((match[2] ?? "").padEnd(6, "0") || "0");
}
