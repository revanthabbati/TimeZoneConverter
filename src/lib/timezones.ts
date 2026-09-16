import type { SearchResult } from '@/types';

/** The viewer's own system timezone — used to show "N hours ahead/behind you" style context. */
export const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Common abbreviations and colloquial place names that don't resolve directly to an IANA zone. */
export const ABBR_MAP: Record<string, string> = {
  ist: 'Asia/Kolkata',
  est: 'America/New_York',
  edt: 'America/New_York',
  cst: 'America/Chicago',
  cdt: 'America/Chicago',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  mst: 'America/Denver',
  mdt: 'America/Denver',
  gmt: 'UTC',
  utc: 'UTC',
  bst: 'Europe/London',
  cet: 'Europe/Berlin',
  sgt: 'Asia/Singapore',
  jst: 'Asia/Tokyo',
  aest: 'Australia/Sydney',
  dallas: 'America/Chicago',
  texas: 'America/Chicago',
  'north carolina': 'America/New_York',
  nc: 'America/New_York',
  india: 'Asia/Kolkata',
  // A handful of IANA zones were renamed over the years (old spelling still valid, but not every
  // ICU/tzdata build enumerates both). Mapping both spellings keeps search working either way.
  kolkata: 'Asia/Kolkata',
  calcutta: 'Asia/Kolkata',
  kathmandu: 'Asia/Kathmandu',
  katmandu: 'Asia/Kathmandu',
  kyiv: 'Europe/Kyiv',
  kiev: 'Europe/Kyiv',
  saigon: 'Asia/Ho_Chi_Minh',
  'ho chi minh': 'Asia/Ho_Chi_Minh',
};

/** A curated set of major business hubs shown when the search box is empty. */
export const POPULAR_ZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
];

let cachedZones: string[] | null = null;

export function allTimeZones(): string[] {
  if (!cachedZones) {
    cachedZones = Intl.supportedValuesOf('timeZone');
  }
  return cachedZones;
}

/**
 * Whether two timezone ids currently behave identically — either because one is a legacy
 * IANA alias of the other (e.g. "Asia/Calcutta" vs "Asia/Kolkata"), or because they're
 * distinct zones that presently share the same rules (e.g. America/Detroit vs
 * America/New_York). `resolvedOptions().timeZone` is meant to canonicalize aliases, but not
 * every ICU build does so, so this compares the long zone name they'd actually display instead.
 */
export function sameZone(a: string, b: string, at: Date = new Date()): boolean {
  if (a === b) return true;
  try {
    return longNameOf(a, at) === longNameOf(b, at);
  } catch {
    return false;
  }
}

function regionOf(tz: string): string {
  if (tz === 'UTC') return 'Universal';
  return tz.split('/')[0]?.replace(/_/g, ' ') ?? tz;
}

export function displayName(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

export function abbrOf(tz: string, at: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
  );
}

export function longNameOf(tz: string, at: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' })
      .format(at)
      .split(',')
      .pop()
      ?.trim() ?? tz
  );
}

export function currentTimeOf(tz: string, hour12: boolean, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  }).format(at);
}

export function utcOffsetMinutes(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const offsetStr = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = offsetStr.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2] ?? '0', 10);
  const mins = parseInt(match[3] ?? '0', 10);
  return sign * (hours * 60 + mins);
}

/** Minutes `tz` currently reads ahead of (positive) or behind (negative) `relativeToTz`. */
export function offsetDiffMinutes(tz: string, relativeToTz: string, at: Date = new Date()): number {
  return utcOffsetMinutes(tz, at) - utcOffsetMinutes(relativeToTz, at);
}

export function getSearchData(tz: string, hour12: boolean, at: Date = new Date()): SearchResult {
  return {
    id: tz,
    name: displayName(tz),
    region: regionOf(tz),
    full: longNameOf(tz, at),
    abbr: abbrOf(tz, at),
    time: currentTimeOf(tz, hour12, at),
  };
}

/**
 * Ranks results so exact/prefix matches on city name beat substring matches
 * elsewhere, keeping the dropdown predictable while typing.
 */
export function searchTimeZones(
  query: string,
  hour12: boolean,
  at: Date = new Date(),
  limit = 20,
): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored: { tz: string; score: number }[] = [];
  const seen = new Set<string>();

  const consider = (tz: string, score: number) => {
    if (seen.has(tz)) return;
    seen.add(tz);
    scored.push({ tz, score });
  };

  const abbrHit = ABBR_MAP[q];
  if (abbrHit) consider(abbrHit, 100);

  for (const tz of allTimeZones()) {
    const city = displayName(tz).toLowerCase();
    const region = regionOf(tz).toLowerCase();
    const full = longNameOf(tz, at).toLowerCase();

    if (city === q) consider(tz, 90);
    else if (city.startsWith(q)) consider(tz, 80);
    else if (city.includes(q)) consider(tz, 60);
    else if (region.includes(q)) consider(tz, 40);
    else if (full.includes(q)) consider(tz, 30);
    else if (tz.toLowerCase().includes(q)) consider(tz, 20);
  }

  return scored
    .sort((a, b) => b.score - a.score || a.tz.localeCompare(b.tz))
    .slice(0, limit)
    .map((s) => getSearchData(s.tz, hour12, at));
}

export function groupByRegion(results: SearchResult[]): Map<string, SearchResult[]> {
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = groups.get(r.region) ?? [];
    list.push(r);
    groups.set(r.region, list);
  }
  return groups;
}
