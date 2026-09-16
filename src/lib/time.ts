export interface ZoneParts {
  hour24: number;
  minute: number;
  hour12: number;
  ampm: 'AM' | 'PM';
  /** yyyy-mm-dd, suitable for <input type="date"> */
  dateISO: string;
  /** HH:MM in 24h, suitable for <input type="time"> */
  pickerValue: string;
}

export function getZoneParts(tz: string, at: Date): ZoneParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(at);
  const hour24 = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  const dateISO = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
  const pickerValue = `${pad(hour24)}:${pad(minute)}`;
  return { hour24, minute, hour12, ampm, dateISO, pickerValue };
}

export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Converts a wall-clock date+time as observed in `tz` into the real instant (UTC) it represents.
 * Intl has no direct "zoned wall time -> instant" API, so this uses the standard round-trip
 * trick: parse the string as local time, measure how far `tz`'s rendering of that instant drifts
 * from the original local-time reading, and correct by the drift.
 */
export function zonedWallTimeToInstant(dateStr: string, timeStr: string, tz: string): Date {
  const iso = `${dateStr}T${timeStr}:00`;
  const guess = new Date(iso);
  const asInZone = new Date(guess.toLocaleString('en-US', { timeZone: tz }));
  return new Date(guess.getTime() + (guess.getTime() - asInZone.getTime()));
}

/** Nudges `at` by +/-12h in `tz` so its wall-clock AM/PM in that zone matches `target`. */
export function withAmPm(at: Date, tz: string, target: 'AM' | 'PM'): Date {
  const { hour24 } = getZoneParts(tz, at);
  const next = new Date(at);
  if (target === 'AM' && hour24 >= 12) next.setHours(next.getHours() - 12);
  if (target === 'PM' && hour24 < 12) next.setHours(next.getHours() + 12);
  return next;
}

/** Parses a typed time string ("9:30", "09:30 PM", ...) into 24h "HH:MM", or null if invalid. */
export function parseTimeInput(raw: string, hour12Mode: boolean, ampm: 'AM' | 'PM'): string | null {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hrs = parseInt(match[1] ?? '0', 10);
  const mins = match[2] ?? '00';
  if (hour12Mode) {
    if (ampm === 'PM' && hrs < 12) hrs += 12;
    if (ampm === 'AM' && hrs === 12) hrs = 0;
  }
  if (hrs > 23) return null;
  return `${pad(hrs)}:${mins}`;
}

export function clockHandDegrees(hour24: number, minute: number): { hourDeg: number; minuteDeg: number } {
  return {
    hourDeg: (hour24 % 12) * 30 + minute * 0.5,
    minuteDeg: minute * 6,
  };
}

export function formatFullLabel(tz: string, at: Date, hour12: boolean): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  }).format(at);
}

export function isWeekendIn(tz: string, at: Date): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(at);
  return weekday === 'Sat' || weekday === 'Sun';
}

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';

/** Coarse time-of-day bucket, used to pick an icon and an accent tint for a zone. */
export function dayPhase(hour24: number): DayPhase {
  if (hour24 >= 5 && hour24 < 7) return 'dawn';
  if (hour24 >= 7 && hour24 < 17) return 'day';
  if (hour24 >= 17 && hour24 < 19) return 'dusk';
  return 'night';
}

export interface RelativeOffset {
  diffMinutes: number;
  label: string;
}

/** How far `tz`'s clock currently reads ahead of / behind `relativeToTz`, e.g. "9h 30m ahead of you". */
export function relativeOffsetLabel(diffMinutes: number): RelativeOffset {
  if (Math.abs(diffMinutes) < 1) return { diffMinutes, label: 'Same time as you' };
  const suffix = diffMinutes > 0 ? 'ahead of you' : 'behind you';
  const abs = Math.abs(diffMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const parts = [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
  return { diffMinutes, label: `${parts} ${suffix}` };
}
