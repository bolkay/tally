export const CURRENCIES = [
  { code: "NGN", label: "Naira" },
  { code: "USD", label: "US dollar" },
  { code: "GBP", label: "Pound sterling" },
  { code: "EUR", label: "Euro" },
  { code: "GHS", label: "Cedi" },
  { code: "KES", label: "Kenyan shilling" },
  { code: "ZAR", label: "Rand" },
  { code: "CAD", label: "Canadian dollar" },
] as const;

/** Amounts are stored in minor units (kobo, cents). */
export function format(minor: number, currency: string, opts: { sign?: boolean } = {}) {
  const f = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
    signDisplay: opts.sign ? "exceptZero" : "auto",
  });
  return f.format(minor / 100);
}

/** Parses "1,250.5" into 125050. Returns null when it is not a positive amount. */
export function parseAmount(input: string): number | null {
  const clean = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null;
}

/** Splits an amount equally, giving leftover kobo to the first people so it always sums exactly. */
export function splitEqually(amount: number, count: number): number[] {
  const base = Math.floor(amount / count);
  const rem = amount - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}
