/**
 * Parse a user-typed time string into seconds. Accepts "90", "1:30",
 * "1:02:03" and an optional ".t" fraction ("1:23.5"). Returns null for
 * anything malformed (including sexagesimal digits ≥ 60).
 */
export function parseTimeString(input: string): number | null {
  const raw = input.trim();
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(raw)) {
    return null;
  }
  const [main, fraction] = raw.split('.');
  const parts = main.split(':').map(Number);
  if (parts.slice(1).some((p) => p >= 60)) {
    return null;
  }
  const seconds = parts.reduce((acc, p) => acc * 60 + p, 0);
  return seconds + (fraction ? Number(`0.${fraction}`) : 0);
}
