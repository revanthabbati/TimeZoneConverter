# TimeZone Converter — browser extension

A companion Chrome/Edge extension: a toolbar popup showing your saved cities and their current
time, so you don't need to open a tab for a quick check.

## Install (unpacked, for now)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin it from the extensions toolbar menu for one-click access.

## What it does

- Search and add any IANA timezone or city; times update live once a second while the popup is open.
- Theme and 12h/24h format, same as the web app.
- **Open full planner** at the bottom hands your current zones and format to the deployed web app
  (via the same share-link query params it already supports), which opens straight into the
  timeline/meeting-planner view with the same cities loaded.

## Why it's a separate, self-contained app

The popup runs in its own extension origin and can't read `localStorage` from
`revanthabbati.github.io` — browsers don't allow one origin to read another's storage, extension
or not. So this keeps its own list in `chrome.storage.local` rather than trying to sync with the
web app; the "Open full planner" link is the deliberate bridge between the two instead.

## Code

`popup.js` is plain JavaScript with no build step, so "load unpacked" works with zero tooling. It
intentionally mirrors (rather than imports) the search/format logic in `../src/lib/timezones.ts`
and `time.ts` — the extension and the web app are built by different toolchains (none vs. Vite),
so sharing source directly isn't a clean fit here.

## Icon regeneration

`icons/*.png` are rendered from `../public/icon.svg` at 16/48/128px. If that SVG changes, re-export
matching PNGs (browsers use raster icons for extension toolbars, not SVG).
