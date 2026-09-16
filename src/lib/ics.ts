import { displayName } from './timezones';
import { formatFullLabel } from './time';

export interface IcsEventOptions {
  start: Date;
  durationMinutes: number;
  title: string;
  zones: string[];
  hour12: boolean;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines longer than 75 octets should be folded with a leading space.
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

export function buildIcs(opts: IcsEventOptions): string {
  const { start, durationMinutes, title, zones, hour12 } = opts;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const now = new Date();
  const uid = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}@timezone-converter`;

  const localLines = zones
    .map((tz) => `${displayName(tz)}: ${formatFullLabel(tz, start, hour12)}`)
    .join('\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TimeZone Converter//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:Local times:\\n${localLines}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n');
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
