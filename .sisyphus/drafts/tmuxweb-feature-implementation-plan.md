# Draft: TmuxWeb Feature Implementation (API docs + backend + frontend + integration)

## Requirements (confirmed)
- Deliverables:
  - API interface documentation (OpenAPI/Swagger or Markdown)
  - Backend API (Express routes + MySQL integration)
  - Frontend UI (match provided React prototype)
  - Frontend integration (connect to backend APIs)
- Backend:
  - Location: `TmuxWeb/server/`
  - Tech: Express + ws + node-pty
  - Auth currently: `middleware/auth.js` token from query param or Bearer header
  - Existing routes: `routes/tmux.js` (tree), `routes/tasks.js` (in-memory Map)
  - Config: `config.json` (port 8215, token, allowedOrigins)
  - Need MySQL support: add `mysql2`
- Frontend:
  - Location: `TmuxWeb/web/src/`
  - Tech: Vite + React 18 + TypeScript
  - Components exist: `TmuxTree.tsx`, `Terminal.tsx`, `TerminalTabs.tsx`
  - State lifted in `App.tsx` via `useState` (constraint: keep this pattern)
  - Auth: `utils/auth.ts` token in localStorage
  - Styling: colocated CSS, dark theme
- Data constraints:
  - Must use existing SQL schema (6 tables) from `.sisyphus/drafts/tmuxweb-sql-schema.sql`
  - Cookie-based auth: HttpOnly cookie, 30 days
- UI constraints:
  - Must match UI prototype from `.sisyphus/drafts/tmuxweb-ui-reference.tsx`

## Planned API Surface (from PRD)
- Auth: POST `/api/auth/login`, POST `/api/auth/logout`
- Profiles: GET/POST/PUT/DELETE `/api/profiles`
- Session Groups: GET/POST/PUT/DELETE `/api/groups`, PUT `/api/sessions/:id/group`
- Ordering: GET/PUT `/api/profiles/:id/order`
- Pane Status: GET/PUT `/api/panes/status`
- Tasks & Segments:
  - POST/GET `/api/panes/:paneKey/tasks`
  - PUT/POST `/api/tasks/:id` (complete, detail)
  - POST/GET `/api/segments/:id` (conversation, commands, logs)
- Summaries:
  - POST `/api/tasks/:id/summarize`
  - GET `/api/panes/:paneKey/summary-candidates`
  - POST `/api/tasks/:id/load-summary`

## Open Questions
- DB connection & migration strategy:
  - How to create tables: run SQL manually or include migration runner/script?
- Cookie auth details:
  - What credential type for login? (token-only vs username/password)
  - Cookie name and domain/samesite settings
- API versioning and base path:
  - Confirm `/api/...` mounted under server root and CORS settings
- Summary generation implementation:
  - Use existing summarizer? or stub endpoint that stores precomputed summary?
- Testing strategy:
  - Do we add backend tests (jest/supertest) and/or frontend tests (vitest/playwright), or rely on agent-executed QA only?

## Scope Boundaries
- INCLUDE: API docs, Express routes, MySQL integration, UI components per prototype, frontend API integration
- EXCLUDE (assumed until confirmed): major frontend state management refactor; redesign beyond prototype; changing tmux/ws/pty core behaviors beyond required integration
