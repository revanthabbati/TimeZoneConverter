# TimeZone Converter

A fast, keyboard-driven timezone converter and meeting planner for distributed teams. Compare cities, drag across a visual timeline to find overlapping working hours, and share a link with your team — all client-side, no account required.

## Features

- **Cards & Timeline views** — compare zones as clock cards, or as a World-Time-Buddy-style timeline with shaded business hours, weekend markers, and date-boundary labels. Click or drag the timeline to change the time across every zone at once.
- **Command palette** (`Ctrl/Cmd+K`) — a unified search + quick-actions box: add a city, toggle theme/format, copy a share link, export to calendar, or open settings without leaving the keyboard.
- **Shareable links** — the current comparison (zones, time, format) encodes into the URL so you can paste it straight into a chat.
- **Calendar export** — download a `.ics` invite for the selected time, with every zone's local time listed in the description.
- **Favorites & recents** — star the zones you use often; they float to the top of search.
- **Light / dark / system theme**, 12h/24h format, drag-to-reorder cards, and a settings panel with JSON export/import/reset for your saved data.
- Installable as a PWA with basic offline support for the app shell.
- Everything is stored in `localStorage` on your device — there is no backend and nothing is sent to a server.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. Other scripts:

```bash
npm run build   # type-check + production build to dist/
npm run preview # preview the production build
npm test        # run the unit test suite (Vitest)
npm run lint     # ESLint
npm run format   # Prettier, write mode
```

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Focus search & quick actions |
| `/` | Focus search |
| `T` | Cycle theme |
| `F` | Toggle 12h / 24h format |
| `V` | Switch cards / timeline view |
| `Ctrl/Cmd + Shift + C` | Copy shareable link |
| `?` | Show the shortcuts list |
| `Esc` | Close any open panel |

## How it works

The app is a static, framework-free TypeScript + Vite build — there's no backend by design, so timezone math relies entirely on the browser's `Intl` APIs (no timezone data is bundled or fetched). The time shown is a snapshot you edit explicitly (via the search bar, card inputs, or the timeline) rather than a live-ticking clock; click **Now** or the brand mark to jump back to the current time.

Source is organized as:

```
src/
  lib/     # pure logic: timezone search, time math, state, share links, .ics export
  ui/      # DOM rendering + event wiring for each view/panel
  styles/  # design tokens and component styles
tests/     # Vitest unit tests for src/lib
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

---

Designed & engineered by revanth. Rebuilt with a modern toolchain, a meeting-planner timeline, command palette, and the rest of the enterprise-tool polish described above.
