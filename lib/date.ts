// Server process TZ may not match the user's TZ (e.g. UTC on serverless hosts),
// so all "today"/day-boundary/display math for this app is done in fixed Malaysia
// local time, not server local time. Single source of truth — do not redefine
// this offset or these helpers elsewhere.
export const MALAYSIA_UTC_OFFSET_HOURS = 8; // Asia/Kuala_Lumpur, UTC+8, no DST

// Returns the UTC-instant bounds of a given YYYY-MM-DD calendar day, as lived
// in the given fixed-offset timezone (e.g. the whole of "2026-08-14" in
// Malaysia local time, expressed as UTC start/end instants for a DB query).
export function dayRangeInTimezone(dateKey: string, offsetHours: number = MALAYSIA_UTC_OFFSET_HOURS) {
  const offsetMs = offsetHours * 60 * 60 * 1000;
  const start = new Date(`${dateKey}T00:00:00.000Z`); // wall-clock time in that TZ, expressed as if UTC
  const end = new Date(`${dateKey}T23:59:59.999Z`);
  return {
    start: new Date(start.getTime() - offsetMs).toISOString(),
    end: new Date(end.getTime() - offsetMs).toISOString(),
  };
}

export function todayRangeInTimezone(offsetHours: number = MALAYSIA_UTC_OFFSET_HOURS) {
  const todayKey = toMalaysiaLocal(new Date().toISOString(), offsetHours).dateKey;
  return dayRangeInTimezone(todayKey, offsetHours);
}

export function toMalaysiaLocal(isoTimestamp: string, offsetHours: number = MALAYSIA_UTC_OFFSET_HOURS) {
  const offsetMs = offsetHours * 60 * 60 * 1000;
  const shifted = new Date(new Date(isoTimestamp).getTime() + offsetMs); // wall-clock time in that TZ, expressed as if UTC
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return { dateKey: `${y}-${mo}-${d}`, timeStr: `${hh}:${mm}` };
}
