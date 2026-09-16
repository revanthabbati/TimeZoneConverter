export interface ShareState {
  zones: string[];
  at: Date;
  hourFormat: 12 | 24;
}

/** Encodes the current comparison into URL query params so it can be shared as a link. */
export function encodeShareUrl(state: ShareState): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('zones', state.zones.join(','));
  url.searchParams.set('t', state.at.toISOString());
  url.searchParams.set('f', String(state.hourFormat));
  return url.toString();
}

/** Reads a shared comparison out of the current URL's query params, if present. */
export function decodeShareUrl(href: string = window.location.href): Partial<ShareState> | null {
  const url = new URL(href);
  const zonesParam = url.searchParams.get('zones');
  const tParam = url.searchParams.get('t');
  const fParam = url.searchParams.get('f');
  if (!zonesParam && !tParam) return null;

  const result: Partial<ShareState> = {};
  if (zonesParam) {
    const zones = zonesParam
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean);
    if (zones.length) result.zones = zones;
  }
  if (tParam) {
    const parsed = new Date(tParam);
    if (!Number.isNaN(parsed.getTime())) result.at = parsed;
  }
  if (fParam === '12' || fParam === '24') {
    result.hourFormat = Number(fParam) as 12 | 24;
  }
  return result;
}

export function clearShareParams(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}
