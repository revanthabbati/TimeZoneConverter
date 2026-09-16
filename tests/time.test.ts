import { describe, expect, it } from 'vitest';
import {
  clockHandDegrees,
  dayPhase,
  getZoneParts,
  parseTimeInput,
  relativeOffsetLabel,
  withAmPm,
  zonedWallTimeToInstant,
} from '@/lib/time';

describe('zonedWallTimeToInstant', () => {
  it('resolves a wall-clock time in a zone ahead of UTC', () => {
    const instant = zonedWallTimeToInstant('2026-06-15', '10:00', 'Asia/Kolkata');
    // 10:00 IST (UTC+5:30) on 2026-06-15 is 04:30 UTC the same day.
    expect(instant.toISOString()).toBe('2026-06-15T04:30:00.000Z');
  });

  it('resolves a wall-clock time in a zone behind UTC', () => {
    const instant = zonedWallTimeToInstant('2026-06-15', '09:00', 'America/New_York');
    // New York is on EDT (UTC-4) in June.
    expect(instant.toISOString()).toBe('2026-06-15T13:00:00.000Z');
  });

  it('round-trips through getZoneParts for the same zone', () => {
    const instant = zonedWallTimeToInstant('2026-01-10', '14:30', 'Europe/London');
    const parts = getZoneParts('Europe/London', instant);
    expect(parts.pickerValue).toBe('14:30');
    expect(parts.dateISO).toBe('2026-01-10');
  });
});

describe('parseTimeInput', () => {
  it('parses 24h input unchanged', () => {
    expect(parseTimeInput('14:05', false, 'AM')).toBe('14:05');
  });

  it('converts 12h PM input to 24h', () => {
    expect(parseTimeInput('2:05', true, 'PM')).toBe('14:05');
  });

  it('converts 12 AM to hour 0', () => {
    expect(parseTimeInput('12:00', true, 'AM')).toBe('00:00');
  });

  it('keeps 12 PM as hour 12', () => {
    expect(parseTimeInput('12:30', true, 'PM')).toBe('12:30');
  });

  it('returns null for unparseable input', () => {
    expect(parseTimeInput('not a time', true, 'AM')).toBeNull();
  });
});

describe('clockHandDegrees', () => {
  it('places hands at 12:00 pointing straight up', () => {
    expect(clockHandDegrees(0, 0)).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });

  it('places the minute hand at 180deg for the half hour', () => {
    expect(clockHandDegrees(3, 30)).toEqual({ hourDeg: 105, minuteDeg: 180 });
  });
});

describe('withAmPm', () => {
  it('shifts a PM time to AM by 12 hours', () => {
    const pm = zonedWallTimeToInstant('2026-03-01', '15:00', 'UTC');
    const am = withAmPm(pm, 'UTC', 'AM');
    expect(getZoneParts('UTC', am).hour24).toBe(3);
  });

  it('leaves an already-AM time unchanged', () => {
    const at = zonedWallTimeToInstant('2026-03-01', '09:00', 'UTC');
    const still = withAmPm(at, 'UTC', 'AM');
    expect(still.getTime()).toBe(at.getTime());
  });
});

describe('dayPhase', () => {
  it('buckets hours into dawn/day/dusk/night', () => {
    expect(dayPhase(6)).toBe('dawn');
    expect(dayPhase(12)).toBe('day');
    expect(dayPhase(18)).toBe('dusk');
    expect(dayPhase(2)).toBe('night');
    expect(dayPhase(23)).toBe('night');
  });
});

describe('relativeOffsetLabel', () => {
  it('reports zero difference as same time', () => {
    expect(relativeOffsetLabel(0).label).toBe('Same time as you');
  });

  it('grammatically reads "ahead of you" for a positive diff', () => {
    expect(relativeOffsetLabel(570).label).toBe('9h 30m ahead of you');
  });

  it('grammatically reads "behind you" (no dangling "of") for a negative diff', () => {
    expect(relativeOffsetLabel(-570).label).toBe('9h 30m behind you');
  });

  it('omits the minutes part when the diff is a whole number of hours', () => {
    expect(relativeOffsetLabel(-120).label).toBe('2h behind you');
  });
});
