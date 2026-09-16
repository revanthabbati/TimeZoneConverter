import { describe, expect, it } from 'vitest';
import { buildIcs } from '@/lib/ics';

describe('buildIcs', () => {
  const start = new Date('2026-07-04T15:00:00Z');

  it('produces a well-formed VCALENDAR with the requested title and duration', () => {
    const ics = buildIcs({
      start,
      durationMinutes: 30,
      title: 'Team sync',
      zones: ['UTC', 'Asia/Kolkata'],
      hour12: false,
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('SUMMARY:Team sync');
    expect(ics).toContain('DTSTART:20260704T150000Z');
    expect(ics).toContain('DTEND:20260704T153000Z');
  });

  it('lists every zone in the description', () => {
    const ics = buildIcs({
      start,
      durationMinutes: 60,
      title: 'Launch call',
      zones: ['UTC', 'Asia/Kolkata'],
      hour12: false,
    });
    // RFC 5545 folds long lines with "\r\n "; unfold before asserting on content
    // so this test doesn't depend on exactly where a fold boundary happens to land.
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('DESCRIPTION:Local times');
    expect(unfolded).toMatch(/Kolkata/);
  });
});
