import { describe, expect, it } from 'vitest';
import { decodeShareUrl, encodeShareUrl } from '@/lib/share';

describe('share link encode/decode', () => {
  it('round-trips zones, time, and format through the URL', () => {
    const at = new Date('2026-05-01T08:30:00Z');
    const url = encodeShareUrl({ zones: ['Asia/Kolkata', 'America/New_York'], at, hourFormat: 12 });

    const decoded = decodeShareUrl(url);
    expect(decoded?.zones).toEqual(['Asia/Kolkata', 'America/New_York']);
    expect(decoded?.at?.toISOString()).toBe(at.toISOString());
    expect(decoded?.hourFormat).toBe(12);
  });

  it('returns null when the URL has no share params', () => {
    expect(decodeShareUrl('https://example.com/')).toBeNull();
  });

  it('ignores an invalid timestamp instead of throwing', () => {
    const decoded = decodeShareUrl('https://example.com/?zones=UTC&t=not-a-date');
    expect(decoded?.zones).toEqual(['UTC']);
    expect(decoded?.at).toBeUndefined();
  });
});
