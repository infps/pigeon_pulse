/**
 * Parse a scan timestamp. Accepts ISO strings (send `toISOString()`), epoch ms
 * (number or 13-digit string), or the legacy compact UTC form
 * YYYYMMDDHHmmss[SSS] still sent by mobile, Web Serial and external scanners.
 * Returns null when unparseable.
 */
export function parseScanTime(input: string | number | undefined | null): Date | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return valid(new Date(input));
  const s = input.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})?$/.exec(s);
  if (m) {
    const [, y, mo, d, h, mi, se, ms] = m;
    return valid(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se, ms ? +ms : 0)));
  }
  if (/^\d{13}$/.test(s)) return valid(new Date(+s)); // epoch ms as string
  return valid(new Date(s));
}

function valid(d: Date): Date | null {
  return Number.isNaN(d.getTime()) ? null : d;
}
