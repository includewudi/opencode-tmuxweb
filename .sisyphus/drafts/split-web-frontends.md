# Draft: Split Desktop Web and Mobile Web Frontend

## Requirements (confirmed)
- [request]: Split mac desktop web and mobile web as separate frontend build outputs.
- [decision]: Only frontend code changes; backend remains shared without modifications.
- [decision]: Desktop vs mobile have different interaction logic and navigation.
- [decision]: URL structure fixed as / (desktop) and /m (mobile).
- [decision]: Prefer explicit split with only minimal shared utilities allowed (types/auth/telemetry if needed).
- [decision]: Test strategy B — add Vitest base configuration; minimal sample tests only.
- [request]: Include a task to diagnose/fix WS connection failure to wss://172.29.15.223:8216/ws/terminal (frontend-side).

## Technical Decisions
- [decision]: Single Vite build with entry-level split and dynamic import per route.
- [decision]: Keep existing routing paths / and /m.
- [decision]: Backend shared; no server changes planned.
## Research Findings
- Current frontend is single Vite build + single entry `web/src/main.tsx` with routes `/` -> `App` and `/m` -> `MobileApp`.
- Desktop root: `web/src/App.tsx`; Mobile root: `web/src/mobile/MobileApp.tsx`.
- Vite config has no multi-entry/MPA setup; `web/index.html` is shared.
- Test infra: no unit test framework; only ad-hoc Playwright scripts in `web/test-*.mjs` run manually.
- User reports https://172.29.15.223:8216 shows no browser "unsafe" warning; cert likely trusted.

## Metis Findings (key risks)
- `components/` is currently shared by mobile; it is NOT desktop-only.
- `Terminal.tsx` is complex; should not be split in this scope.
- `global.css` contains both desktop and mobile selectors; avoid splitting it.
- Mobile/desktop localStorage keys are already namespaced; do not rename.
- `components/` is currently shared by mobile; it is NOT desktop-only.
- `Terminal.tsx` is complex; should not be split in this scope.
- `global.css` contains both desktop and mobile selectors; avoid splitting it.
- Mobile/desktop localStorage keys are already namespaced; do not rename.

## Open Questions
- None (decisions confirmed).

## Scope Boundaries
- INCLUDE: Frontend-only split into separate build outputs for / and /m, with distinct navigation and interaction flows.
- INCLUDE: WS connection failure investigation in frontend (config/URL/protocol handling).
- EXCLUDE: Backend/server changes, API changes, auth changes.
