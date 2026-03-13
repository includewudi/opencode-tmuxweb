# Code Style

## Language & Modules
- **Backend**: JavaScript (CommonJS) — `require()` / `module.exports`
- **Frontend**: TypeScript + React (ESM) — `import` / `export`

## Formatting
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Used in backend JS; frontend TS uses standard TS/JS style (no enforced lint config)

## Naming

| Element             | Convention     | Example                         |
|---------------------|----------------|---------------------------------|
| Variables/functions | camelCase      | `fetchProfiles`, `paneId`       |
| React components    | PascalCase     | `TerminalTabs`, `MobileApp`     |
| Component files     | PascalCase.tsx | `LoginModal.tsx`                |
| Hook files          | useCamelCase.ts| `useKeyboardAvoider.ts`         |
| Route files         | kebab-case.js  | `tasks-db.js`, `task-events.js` |
| Constants           | UPPER_SNAKE    | `COOKIE_NAME`                   |

## Imports — Order
```ts
// 1. React / external packages
import { useState } from 'react'
import { Menu } from 'lucide-react'

// 2. Local modules
import { TmuxTree } from './components/TmuxTree'
import { checkAuth } from './utils/auth'
```

## Error Handling (Backend)
```js
router.post('/endpoint', async (req, res) => {
  try {
    const result = await pool.query(...)
    res.json({ data: result })
  } catch (err) {
    console.error('[route POST /endpoint]', err)
    res.status(500).json({ error: 'internal_error', message: err.message })
  }
})
```

## React Patterns
- **Functional components only**
- **React Router** in `main.tsx` (`/` desktop, `/m` mobile)
- **Local state** with hooks; no Redux/Zustand
- **Styling**: CSS files in `src/styles` and component-specific CSS
