import { describe, expect, it } from 'vitest';
import { displayName, groupByRegion, searchTimeZones, utcOffsetMinutes } from '@/lib/timezones';

const AT = new Date('2026-06-15T12:00:00Z');

describe('displayName', () => {
  it('turns an IANA id into a readable city name', () => {
    expect(displayName('America/New_York')).toBe('New York');
    expect(displayName('Asia/Kolkata')).toBe('Kolkata');
  });
});

describe('searchTimeZones', () => {
  it('resolves a known abbreviation to its IANA zone', () => {
    const results = searchTimeZones('ist', false, AT);
    expect(results[0]?.id).toBe('Asia/Kolkata');
  });

  it('ranks an exact city match above a partial one', () => {
    const results = searchTimeZones('london', false, AT);
    expect(results[0]?.id).toBe('Europe/London');
  });

  it('returns nothing for a blank query', () => {
    expect(searchTimeZones('   ', false, AT)).toEqual([]);
  });

  it('never returns duplicate zone ids', () => {
    const results = searchTimeZones('a', false, AT, 200);
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('groupByRegion', () => {
  it('buckets results by their region prefix', () => {
    const results = searchTimeZones('a', false, AT, 50);
    const groups = groupByRegion(results);
    for (const [region, items] of groups) {
      for (const item of items) expect(item.region).toBe(region);
    }
  });
});

describe('utcOffsetMinutes', () => {
  it('reports zero for UTC', () => {
    expect(utcOffsetMinutes('UTC', AT)).toBe(0);
  });

  it('reports a positive half-hour offset for India', () => {
    expect(utcOffsetMinutes('Asia/Kolkata', AT)).toBe(330);
  });

  it('reports a negative offset for US zones', () => {
    expect(utcOffsetMinutes('America/Los_Angeles', AT)).toBeLessThan(0);
  });
});
