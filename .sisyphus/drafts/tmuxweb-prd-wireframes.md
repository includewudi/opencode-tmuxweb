# Draft: TmuxWeb PRD + Wireframes for UI Design

## Requirements (confirmed)
- UI style: Dense / IDE-like.
- Mobile interaction support required.
- Auth: user inputs token once; stays logged in 30 days via HttpOnly cookie session.
- Token source stored in config file.
- Profiles/workspaces:
  - Unlimited
  - Switch via UI dropdown
- Session grouping:
  - Sessions can be assigned into groups (e.g., project)
  - Relationship: each session belongs to exactly one group (A)
- Tree UX:
  - Session/Window/Pane tree exists
  - Default collapsed; **only Session list visible by default** (A)
  - Expand session to show windows; expand window to show panes
- Ordering:
  - Drag-and-drop **session-level ordering as whole units**
  - Persist order server-side per token + profile
- Pane status:
  - idle / in-progress / done
  - Show badge on pane row; allow user to update status
- Tasks:
  - User has many sequential tasks
  - Each Task creates a new Segment (log segmentation)
- Pane logs shared across profiles
- Pane management:
  - Conversation record (two-way)
  - Command record (human one-way)
  - Command summary + output summary via external summary service (contract only)
- Summary loading:
  - If tmux closes and reopens with same session name, allow user to choose historical summary to load
  - UX entrypoints: modal on pane open + explicit button in pane details
- Pane details layout: **right side drawer** on desktop; mobile uses left sidebar drawer + details as bottom sheet/fullscreen.

## UX / IA summary
- Top bar: profile dropdown + login/logout
- Left sidebar: sessions tree (collapsed by default)
- Main: terminal tabs + terminal
- Right drawer: pane details (status, tasks, logs, summaries)
- Modals: token login; summary candidate picker

## Wireframes (low-fidelity ASCII)

### Login modal
```
+--------------------------------------+
|  Login                               |
|--------------------------------------|
|  Enter Token                         |
|  [__________________________]        |
|                                      |
|  Remember me 30 days (default)       |
|                                      |
|  [ Cancel ]              [ Login ]   |
+--------------------------------------+
```

### Main layout (tree collapsed)
```
+--------------------------------------------------------------------------------+
|  Profile: [ default v ]   [Logout]                          TmuxWeb            |
+---------------------------+----------------------------------------------------+
|  Sessions (collapsed)     |  Terminal Tabs + Terminal                          |
|---------------------------|                                                    |
|  :: drag handle  > dify   |  +------------------ Tabs -----------------------+ |
|  :: drag handle  > hsk    |  | [Pane %1] [Pane %2] [+]                       | |
|  :: drag handle  > omo    |  +-----------------------------------------------+ |
|                           |  |                                               | |
|                           |  |                 Terminal                      | |
|                           |  |                                               | |
|                           |  +-----------------------------------------------+ |
|                           |                                                    |
|                           |  Right Drawer: Pane Details                        |
+---------------------------+----------------------------------------------------+
```

### Tree expanded to panes (with status badges)
```
Sessions
  v dify
    > 1:zsh
  v hsk
    v 1:zsh
      - %1   [Idle]
      - %2   [In Progress]
      - %3   [Done]
```

### Pane details drawer
```
+---------------- Pane: hsk / 1:zsh / %2 ----------------+
| Status: [ In Progress v ]    [Load previous summary]   |
|--------------------------------------------------------|
| Current Task:  #123  "Untitled"                         |
| [Mark Done]   [New Task]                                |
|--------------------------------------------------------|
| Segment Logs                                            |
|  - Conversation (two-way)                               |
|  - Commands (human)                                     |
|--------------------------------------------------------|
| Summaries                                               |
|  Command Summary:  [Generate/Retry]                     |
|  Output Summary:   [Generate/Retry]                     |
+--------------------------------------------------------+
```

### Summary candidate picker modal
```
+----------------------------------------------+
|  Load previous summary?                       |
|----------------------------------------------|
|  Found N candidates for session "dify"        |
|                                              |
|  ( ) 2026-02-08 18:20  window 1 / pane 1      |
|      preview: "Implemented cookie auth..."    |
|  ( ) ...                                      |
|                                              |
|  [Skip]                         [Load]       |
+----------------------------------------------+
```

---

## Session Grouping

### Data Model
- Groups are optional containers for sessions
- Each session belongs to exactly ONE group (or no group = ungrouped)
- Groups have `sort_order`; sessions within groups also have `sort_order`
- **Display rule**: When sorted, ungrouped sessions with same `sort_order` appear BEFORE groups

### Tree Structure with Groups
```
Sessions
  :: drag  > dify           (ungrouped, sort=10)
  :: drag  v [AI Projects]  (group, sort=10, displayed after ungrouped with same sort)
             :: drag  > hsk
             :: drag  > omo
  :: drag  > misc           (ungrouped, sort=20)
  :: drag  v [DevOps]       (group, sort=30)
             :: drag  > infra
```

### Group Operations
- Create group: context menu or toolbar button
- Rename group: inline edit or context menu
- Delete group: moves contained sessions to ungrouped
- Drag session INTO group: drop on group row
- Drag session OUT of group: drop on root level
- Drag group: reorder entire group with its sessions

---

## Mobile UI Wireframes

### Mobile Layout Overview
- **No persistent sidebars** - all in drawers/sheets
- **Bottom navigation**: Sessions | Terminal | Details
- **Gestures**: swipe right for sessions drawer, swipe up for details sheet

### Mobile: Sessions Drawer (Left)
```
+------------------------------------------+
| [X]  Sessions               [+ Group]    |
|------------------------------------------|
| Profile: [ default v ]                   |
|------------------------------------------|
|  [Edit Order]                            |
|                                          |
|  > dify                                  |
|  v [AI Projects]                         |
|    > hsk                                 |
|    > omo                                 |
|  > misc                                  |
|                                          |
|------------------------------------------|
|             [ Logout ]                   |
+------------------------------------------+
```

### Mobile: Terminal View (Main)
```
+------------------------------------------+
| < Back    hsk / 1:zsh / %2    [Details]  |
|------------------------------------------|
|                                          |
|            Terminal (xterm.js)           |
|            Full viewport height          |
|                                          |
|------------------------------------------|
| [Sessions]    [Terminal]    [Details]    |
+------------------------------------------+
```

### Mobile: Details Sheet (Bottom, half-screen default)
```
+------------------------------------------+
|  ----  (drag handle to expand/collapse)  |
|------------------------------------------|
| Pane: hsk / 1:zsh / %2                   |
| Status: [ In Progress v ]                |
|------------------------------------------|
| Current Task: #123 "Auth impl"           |
| [Mark Done]   [New Task]                 |
|------------------------------------------|
| [Load Previous Summary]                  |
|------------------------------------------|
| > Conversation (tap to expand)           |
| > Commands (tap to expand)               |
| > Summaries (tap to expand)              |
+------------------------------------------+
```

### Mobile: Drag Reorder Mode
```
+------------------------------------------+
| [Done]  Reorder Sessions                 |
|------------------------------------------|
|  ≡  dify                                 |
|  ≡  [AI Projects]                        |
|      ≡  hsk                              |
|      ≡  omo                              |
|  ≡  misc                                 |
|                                          |
| Drag ≡ handle to reorder                 |
| Long press to move in/out of groups      |
+------------------------------------------+
```

### Mobile: Summary Picker (Full-screen Modal)
```
+------------------------------------------+
| [X]  Load Previous Summary               |
|------------------------------------------|
| Found 3 candidates for "dify"            |
|                                          |
| +--------------------------------------+ |
| | 2026-02-08 18:20                     | |
| | window 1 / pane 1                    | |
| | "Implemented cookie auth..."         | |
| +--------------------------------------+ |
|                                          |
| +--------------------------------------+ |
| | 2026-02-07 14:30                     | |
| | window 1 / pane 2                    | |
| | "Added MySQL migrations..."          | |
| +--------------------------------------+ |
|                                          |
|------------------------------------------|
|    [Cancel]              [Load Selected] |
+------------------------------------------+
```

---

## Desktop Pane Details Drawer (Enhanced)

### With Session Groups Context
```
+------------------------ Pane Details --------------------------+
| Session: hsk                                                   |
| Group: [AI Projects v]  (dropdown to change or "No Group")     |
| Window: 1:zsh                                                  |
| Pane: %2                                                       |
|----------------------------------------------------------------|
| Status: [ In Progress v ]      [Load previous summary]         |
|----------------------------------------------------------------|
| Current Task                                                   |
|  #123 "Auth implementation"                                    |
|  Started: 2026-02-08 10:30                                     |
|  [Mark Done]   [New Task]                                      |
|----------------------------------------------------------------|
| Segment Logs                                                   |
|  Conversation (5 messages)                [Expand/Collapse]    |
|    - user: Please add login endpoint                           |
|    - assistant: I'll create POST /api/auth/login...            |
|  Commands (12 commands)                   [Expand/Collapse]    |
|    - npm install jsonwebtoken                                  |
|    - curl -X POST localhost:8215/api/auth/login...             |
|----------------------------------------------------------------|
| Summaries                                                      |
|  Command Summary:  "Setup JWT auth with cookie-based..."       |
|                    [Regenerate]                                |
|  Output Summary:   "Successfully implemented login..."         |
|                    [Regenerate]                                |
|----------------------------------------------------------------|
| Previous Tasks (collapsed by default)                          |
|  > #122 "Database setup" - Completed 2026-02-07                |
|  > #121 "Initial scaffold" - Completed 2026-02-06              |
+----------------------------------------------------------------+
```

---

## Interaction Details

### Drag & Drop Behaviors

| Source | Target | Result |
|--------|--------|--------|
| Session (ungrouped) | Root level | Reorder within ungrouped |
| Session (ungrouped) | Group row | Move session INTO group |
| Session (in group) | Root level | Move session OUT of group |
| Session (in group) | Same group | Reorder within group |
| Session (in group) | Different group | Move to new group |
| Group | Root level | Reorder group position |
| Group | Another group | Not allowed (no nesting) |

### Sort Order Rules
1. All items sorted by `sort_order` ascending
2. At same `sort_order`: ungrouped sessions appear BEFORE groups
3. Groups contain sessions sorted by their own `sort_order`

### State Transitions

| From State | Action | To State |
|------------|--------|----------|
| Idle | User starts task | In Progress |
| In Progress | User marks done | Done |
| Done | User creates new task | In Progress |
| Any | Manual status change | Selected status |

### Empty States

| Context | Empty State Message | Action |
|---------|---------------------|--------|
| No sessions | "No tmux sessions found" | - |
| No groups | (Just show ungrouped sessions) | - |
| No tasks for pane | "No tasks yet" | [Create First Task] button |
| No summaries | "No summaries generated" | [Generate Summary] button (or "Not configured" if service unavailable) |
| No candidates for load | "No previous summaries found" | Dismiss modal |

### Error States

| Error | Display | Recovery |
|-------|---------|----------|
| Auth failed | Toast + redirect to login | Re-enter token |
| Session disconnected | Terminal overlay "Disconnected" | [Reconnect] button |
| Summary service unavailable | "Summary service not configured" | Hide generate buttons |
| Network error on save | Toast "Failed to save. Retry?" | [Retry] button |

---

## Component Inventory

### Shared Components

| Component | Usage |
|-----------|-------|
| `ProfileDropdown` | Header - switch profiles |
| `SessionTree` | Left sidebar - session/group/window/pane hierarchy |
| `TreeNode` | Recursive tree item with expand/collapse/drag |
| `GroupNode` | Tree node variant for groups |
| `StatusBadge` | Inline badge (Idle/In Progress/Done) |
| `StatusDropdown` | Change pane status |
| `PaneDetailsDrawer` | Right drawer (desktop) |
| `PaneDetailsSheet` | Bottom sheet (mobile) |
| `TaskCard` | Display current/previous task info |
| `LogAccordion` | Collapsible conversation/command logs |
| `SummarySection` | Display summaries with regenerate action |
| `SummaryCandidatePicker` | Modal for selecting historical summary |
| `LoginModal` | Token input modal |
| `Toast` | Notifications for success/error |

### Mobile-Only Components

| Component | Usage |
|-----------|-------|
| `SessionsDrawer` | Left slide-out for session tree |
| `BottomNav` | Tab navigation (Sessions/Terminal/Details) |
| `ReorderMode` | Special mode for drag handles |

### Desktop-Only Components

| Component | Usage |
|-----------|-------|
| `TerminalTabs` | Tab bar for multiple open panes |

---

## API Endpoints Summary (for Backend Reference)

### Auth
- `POST /api/auth/login` - Login with token, set HttpOnly cookie
- `POST /api/auth/logout` - Clear session

### Profiles
- `GET /api/profiles` - List profiles
- `POST /api/profiles` - Create profile
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile

### Session Groups
- `GET /api/groups` - List groups (with session counts)
- `POST /api/groups` - Create group
- `PUT /api/groups/:id` - Update group (name, sort_order)
- `DELETE /api/groups/:id` - Delete group (sessions become ungrouped)
- `PUT /api/sessions/:id/group` - Assign session to group (or null for ungrouped)

### Ordering
- `GET /api/profiles/:id/order` - Get current order
- `PUT /api/profiles/:id/order` - Save new order

### Pane Status
- `GET /api/panes/status` - Get status for pane(s)
- `PUT /api/panes/status` - Update pane status

### Tasks & Segments
- `POST /api/panes/:paneKey/tasks` - Create new task (creates segment)
- `GET /api/panes/:paneKey/tasks` - List tasks for pane
- `PUT /api/tasks/:id` - Update task (title, status)
- `POST /api/tasks/:id/complete` - Mark task done
- `GET /api/tasks/:id/detail` - Get task with logs and summaries

### Logs
- `POST /api/segments/:id/conversation` - Add conversation message
- `POST /api/segments/:id/commands` - Add command record
- `GET /api/segments/:id/logs` - Get all logs for segment

### Summaries
- `POST /api/tasks/:id/summarize` - Trigger summary generation
- `GET /api/panes/:paneKey/summary-candidates` - Find historical summaries
- `POST /api/tasks/:id/load-summary` - Load/import previous summary

---

## Open Questions
- Visual style preferences (dense vs spacious; badge colors)
- Whether to support window rename in UI now or later
- Summary attach semantics (copy into current task vs link old task)
