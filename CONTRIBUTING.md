# Contributing

Thanks for considering a contribution.

## Setup

```bash
npm install
npm run dev
```

## Before opening a PR

```bash
npm run lint
npm test
npm run build
```

All three must pass — they also run in CI on every pull request.

## Guidelines

- Keep new logic in `src/lib/` pure and covered by a test in `tests/`; keep DOM wiring in `src/ui/`.
- Match the existing code style (Prettier/ESLint are authoritative — run `npm run format` if unsure).
- Prefer small, focused PRs with a clear description of the behavior change.
- UI changes should work in both light and dark theme, and down to a ~375px-wide viewport.
