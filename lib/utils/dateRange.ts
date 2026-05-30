/**
 * Converts a 'YYYY-MM-DD' local calendar day into its UTC ISO bounds
 * { startIso, endIso } spanning local midnight to the next local midnight.
 */
export function dayRangeIso(day: string): { startIso: string; endIso: string } {
  const [year, month, date] = day.split('-').map(Number);
  // Constructed in local time so the day boundaries match the user's timezone.
  const start = new Date(year, month - 1, date, 0, 0, 0, 0);
  const end = new Date(year, month - 1, date + 1, 0, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Formats a Date as a local 'YYYY-MM-DD' string for use as a filter day key. */
export function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}
