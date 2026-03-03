# 御書房 (Imperial Study) — TmuxWeb Plugin UI Design Spec

> **Purpose**: Complete UI specification for external prototyping tool.
> **Target**: TmuxWeb sidebar plugin (React + TypeScript + xterm.js)
> **Date**: 2026-03-03
> **Status**: Design Draft

---

## 1. Plugin Architecture Overview

### 1.1 Open-Source vs Private Boundary

```
TmuxWeb (open-source)                    御書房 Plugin (private)
┌──────────────────────┐                 ┌──────────────────────┐
│ Plugin System API    │◀── registers ───│ imperial-study/      │
│ registerSidebarPlugin│                 │   index.ts           │
│ Activity Bar slots   │                 │   components/        │
│ Sidebar panel mount  │                 │   hooks/             │
└──────────────────────┘                 │   styles/            │
                                         └──────────────────────┘
                                         Location: plugins/imperial-study/
                                         Git: .gitignored
```

### 1.2 Plugin Registration Interface

```typescript
interface SidebarPlugin {
  id: string;                              // 'imperial-study'
  icon: React.ComponentType<LucideProps>;   // Activity Bar icon
  label: string;                           // Tooltip text
  component: React.ComponentType;          // Sidebar panel content
  badge?: () => number | null;             // Optional notification count
}

// Plugin registers itself:
registerSidebarPlugin({
  id: 'imperial-study',
  icon: ScrollText,          // Lucide: ScrollText (御書房 scroll icon)
  label: '御書房',
  component: ImperialStudyPanel,
  badge: () => unreadInboxCount,
});
```

---

## 2. Layout Integration

### 2.1 Activity Bar — Icon Placement

```
┌──────────────────────────────────────────────────────────┐
│ Activity Bar (48px)  │ Primary Sidebar (220px)           │
│                      │                                    │
│ ┌──────┐             │                                    │
│ │  📟  │ ← Terminal  │  (content switches based on        │
│ │ tab  │   (existing)│   active activity tab)             │
│ └──────┘             │                                    │
│ ┌──────┐             │                                    │
│ │  📜  │ ← 御書房    │                                    │
│ │ tab  │   (NEW)     │                                    │
│ └──────┘             │                                    │
│                      │                                    │
│  ...spacer...        │                                    │
│                      │                                    │
│ ┌──────┐             │                                    │
│ │  ⚙️  │ ← Settings  │                                    │
│ └──────┘             │                                    │
│ ┌──────┐             │                                    │
│ │  🚪  │ ← Logout    │                                    │
│ └──────┘             │                                    │
└──────────────────────────────────────────────────────────┘
```

**Icon Specs:**
- Size: 22px (matches existing activity-tab icons)
- Color idle: `var(--zinc-500)` (#71717a)
- Color hover: `var(--zinc-300)` (#d4d4d8)
- Color active: `var(--zinc-100)` with left border `var(--blue-500)` (#3b82f6)
- Badge (unread inbox): 8px red dot, position top-right of icon

### 2.2 Sidebar Panel — Overall Structure

When 御書房 activity tab is active, the Primary Sidebar (220px) renders:

```
┌─────────────────────────────────┐
│ 御書房                     [⟳]  │ ← Header (48px)
│ 2 workers · 3 inbox             │ ← Subtitle stats
├─────────────────────────────────┤
│ ┌─ Workers ──────────── [+] ──┐ │
│ │                              │ │
│ │ 🟢 quant-researcher    busy  │ │ ← WorkerCard
│ │    butler/quant  ·  :9901    │ │
│ │                              │ │
│ │ 🟡 code-reviewer      idle  │ │ ← WorkerCard
│ │    opencode  ·  :9902        │ │
│ │                              │ │
│ │ 🔴 site-fixer        error  │ │ ← WorkerCard
│ │    my-site  ·  :9903         │ │
│ │                              │ │
│ └──────────────────────────────┘ │
│                                   │
│ ┌─ Inbox (3) ─────────────────┐ │
│ │                              │ │
│ │ 🔵 quant-researcher         │ │ ← InboxCard
│ │    需要确认：是否使用 ccxt?   │ │
│ │    2 min ago                  │ │
│ │                              │ │
│ │ 🟠 code-reviewer            │ │ ← InboxCard
│ │    发现3个安全问题            │ │
│ │    15 min ago                 │ │
│ │                              │ │
│ │ ✅ site-fixer               │ │ ← InboxCard (replied)
│ │    修复完成，请验收           │ │
│ │    1 hr ago                   │ │
│ │                              │ │
│ └──────────────────────────────┘ │
│                                   │
│ ┌─ Activity ──────────────────┐ │
│ │ 14:32  worker_launched       │ │ ← ActivityRow
│ │ 14:28  task_completed        │ │
│ │ 14:15  inbox_received        │ │
│ │ 13:50  reply_sent            │ │
│ │                              │ │
│ └──────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 3. Component Hierarchy

```
ImperialStudyPanel                    ← Plugin root (220px sidebar)
├── PanelHeader                       ← Title + refresh + stats
│   └── StatLine                      ← "{n} workers · {n} inbox"
├── WorkerSection                     ← Collapsible section
│   ├── SectionHeader                 ← "Workers" + [+] button
│   └── WorkerCard[]                  ← Per-worker summary
│       ├── WorkerStatusDot           ← State indicator (colored dot)
│       ├── WorkerName                ← session_id alias
│       ├── WorkerState               ← "busy" | "idle" | "error" ...
│       └── WorkerMeta                ← project · port
├── InboxSection                      ← Collapsible section
│   ├── SectionHeader                 ← "Inbox ({count})"
│   └── InboxCard[]                   ← Per-inbox-item summary
│       ├── InboxKindIcon             ← Kind indicator
│       ├── InboxWorkerName           ← Source worker
│       ├── InboxTitle                ← Truncated title
│       └── InboxTimestamp            ← Relative time
└── ActivitySection                   ← Collapsible section
    ├── SectionHeader                 ← "Activity"
    └── ActivityRow[]                 ← Compact event log
        ├── ActivityTime              ← HH:mm
        └── ActivitySummary           ← event_type + summary
```

---

## 4. Component Detail Specs

### 4.1 PanelHeader

```
┌─────────────────────────────────┐
│ 御書房                     [⟳]  │  height: 48px
│ 2 workers · 3 inbox             │  padding: 10px 12px
└─────────────────────────────────┘
```

| Element       | Style                                          |
|---------------|------------------------------------------------|
| Title "御書房" | font-size: 14px, font-weight: 600, color: var(--zinc-200) |
| Refresh icon  | Lucide `RefreshCw`, 16px, var(--zinc-500), hover: var(--zinc-300) |
| Subtitle      | font-size: 0.75rem, color: var(--zinc-400), margin-top: 2px |

### 4.2 SectionHeader

```
┌─ Workers ──────────────── [+] ──┐  height: 32px
```

| Element          | Style                                          |
|------------------|------------------------------------------------|
| Chevron (▸/▾)    | Lucide `ChevronRight`/`ChevronDown`, 14px, var(--zinc-500) |
| Section label    | font-size: 0.8rem, font-weight: 500, color: var(--zinc-400), text-transform: uppercase, letter-spacing: 0.5px |
| Action button    | Lucide icon, 14px, var(--zinc-600), hover: var(--zinc-300) |
| Separator        | border-bottom: 1px solid var(--zinc-800) |

### 4.3 WorkerCard

```
┌──────────────────────────────────┐
│ 🟢 quant-researcher        busy │  height: ~52px
│    butler/quant  ·  :9901       │  padding: 8px 12px
└──────────────────────────────────┘
```

| Element          | Style                                          |
|------------------|------------------------------------------------|
| Status dot       | 8px circle, border-radius: 50%                |
| Worker name      | font-size: 13px, font-weight: 500, color: var(--zinc-200) |
| State label      | font-size: 0.7rem, color: state-dependent (see §5) |
| Project          | font-size: 0.7rem, color: var(--zinc-500) |
| Port             | font-size: 0.7rem, color: var(--zinc-500), font-family: monospace |
| Hover bg         | background: var(--blue-900-20), border-radius: 6px |
| Click action     | Focus terminal tab for this worker's pane_target |
| Cursor           | pointer                                        |

**Worker State Colors (dot + label):**

| State      | Dot Color              | Label Color            |
|------------|------------------------|------------------------|
| launching  | var(--yellow-500)      | var(--yellow-500)      |
| idle       | var(--amber-500)       | var(--zinc-400)        |
| busy       | var(--green-500)       | var(--green-500)       |
| exited     | var(--zinc-600)        | var(--zinc-500)        |
| error      | var(--red-400)         | var(--red-400)         |

### 4.4 InboxCard

```
┌──────────────────────────────────┐
│ 🔵 quant-researcher             │  height: ~56px
│    需要确认：是否使用 ccxt?      │  padding: 8px 12px
│    2 min ago                     │
└──────────────────────────────────┘
```

| Element          | Style                                          |
|------------------|------------------------------------------------|
| Kind icon        | 14px, kind-dependent (see below)               |
| Worker name      | font-size: 12px, font-weight: 500, color: var(--zinc-400) |
| Title            | font-size: 13px, color: var(--zinc-200), max 2 lines, overflow: ellipsis |
| Timestamp        | font-size: 0.7rem, color: var(--zinc-600)      |
| Unread indicator | Left border: 2px solid var(--blue-500) (pending items only) |
| Hover bg         | background: var(--blue-900-20), border-radius: 6px |
| Click action     | Open InboxDetailModal                          |

**Inbox Kind Icons:**

| Kind       | Icon (Lucide)        | Color                  |
|------------|----------------------|------------------------|
| question   | `HelpCircle`         | var(--blue-500)        |
| approval   | `ShieldCheck`        | var(--amber-500)       |
| report     | `FileText`           | var(--zinc-400)        |
| error      | `AlertTriangle`      | var(--red-400)         |
| completion | `CheckCircle2`       | var(--green-500)       |

**Inbox Status Visual:**

| Status     | Visual Effect                                  |
|------------|------------------------------------------------|
| pending    | Left blue border + bold title                  |
| read       | No left border, normal weight                  |
| replied    | Dimmed (opacity: 0.6) + ✅ icon overlay        |
| dismissed  | Dimmed (opacity: 0.4) + strikethrough title    |

### 4.5 ActivityRow

```
│ 14:32  quant  worker_launched               │  height: 28px
```

| Element          | Style                                          |
|------------------|------------------------------------------------|
| Timestamp        | font-size: 0.7rem, color: var(--zinc-600), font-family: monospace, min-width: 40px |
| Worker alias     | font-size: 0.7rem, color: var(--zinc-500), max-width: 50px, overflow: hidden |
| Event summary    | font-size: 0.75rem, color: var(--zinc-400), flex: 1 |
| Event dot        | 6px circle, event-type color (same mapping as worker states) |
| Max visible      | 20 rows, scroll for more                      |

---

## 5. Modal / Overlay Specs

### 5.1 InboxDetailModal

Triggered by clicking an InboxCard. Renders as a floating panel overlaying the terminal area.

```
┌─────────────────────────────────────────────┐
│ ✕                          Inbox Detail      │  header: 48px
├─────────────────────────────────────────────┤
│                                              │
│  Kind: 🔵 question                          │
│  From: quant-researcher                      │
│  Time: 2026-03-03 14:32:15                   │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  需要确认：是否使用 ccxt 库进行      │    │  body area
│  │  交易所数据获取？                     │    │  max-height: 60vh
│  │                                      │    │  overflow-y: auto
│  │  目前调研了以下选项：                 │    │
│  │  1. ccxt — 支持 100+ 交易所          │    │
│  │  2. binance-connector — 官方 SDK     │    │
│  │  3. 自行封装 REST API                │    │
│  │                                      │    │
│  │  建议使用 ccxt，理由：...            │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌────────────────────────────────────┐      │
│  │  Reply message...                  │      │  textarea: 80px
│  └────────────────────────────────────┘      │
│                                              │
│  [Approve ✓]  [Reject ✕]  [Reply →]         │  action buttons
│                                              │
└─────────────────────────────────────────────┘
```

**Modal Specs:**

| Element          | Style                                          |
|------------------|------------------------------------------------|
| Overlay bg       | rgba(0,0,0, 0.5), backdrop-filter: blur(4px)  |
| Modal bg         | var(--zinc-900), border: 1px solid var(--zinc-800) |
| Width            | min(480px, 90vw)                               |
| Max height       | 80vh                                           |
| Border radius    | 12px                                           |
| Shadow           | 0 8px 32px rgba(0,0,0,0.4)                    |
| Close button     | Lucide `X`, 18px, var(--zinc-500), hover: var(--zinc-200) |
| Kind badge       | Same icon/color as InboxCard (see §4.4)        |
| Body text        | font-size: 14px, color: var(--zinc-200), white-space: pre-wrap |
| Textarea         | bg: var(--zinc-950), border: 1px solid var(--zinc-700), color: var(--zinc-200), font-size: 14px, resize: vertical |
| Approve button   | bg: var(--green-500), color: white, border-radius: 6px, padding: 8px 16px |
| Reject button    | bg: var(--red-400), color: white, border-radius: 6px, padding: 8px 16px |
| Reply button     | bg: var(--blue-500), color: white, border-radius: 6px, padding: 8px 16px |

### 5.2 Worker Context Menu (Right-click)

```
┌──────────────────────┐
│ 📟 Open Terminal     │
│ 📋 Copy pane target  │
│ ⏸  Pause worker      │
│ 🔴 Kill worker       │
└──────────────────────┘
```

| Element          | Style                                          |
|------------------|------------------------------------------------|
| Menu bg          | var(--zinc-900), border: 1px solid var(--zinc-800) |
| Width            | 180px                                          |
| Item height      | 32px                                           |
| Item padding     | 8px 12px                                       |
| Item hover       | bg: var(--blue-900-20)                         |
| Icon size        | 14px                                           |
| Text             | font-size: 13px, color: var(--zinc-200)        |
| Danger item      | color: var(--red-400)                          |
| Border radius    | 8px                                            |
| Shadow           | 0 4px 16px rgba(0,0,0,0.3)                    |

---

## 6. Interaction Flows

### 6.1 Switch to 御書房 Panel

```
User clicks 御書房 icon in Activity Bar
  → Activity tab gets "active" class (blue left border + bright icon)
  → Terminal tab loses "active" class
  → Primary Sidebar content swaps:
      OUT: ProfileSelector + TaskStatBadges + TmuxTree
      IN:  PanelHeader + WorkerSection + InboxSection + ActivitySection
  → Main terminal area UNCHANGED (stays visible)
  → Toolbox panel UNCHANGED
```

### 6.2 Click Worker → Focus Terminal

```
User clicks WorkerCard
  → Find terminal tab matching worker.pane_target
  → If tab exists: switch to it (same as clicking a tmux pane in TmuxTree)
  → If tab not found: create new terminal tab connected to worker.pane_target
  → Worker card gets brief highlight animation (200ms blue flash)
```

### 6.3 Inbox Reply Flow

```
User clicks InboxCard (status=pending)
  → InboxDetailModal opens
  → User reads body content
  → User types reply in textarea (optional for Approve/Reject)
  → User clicks [Approve], [Reject], or [Reply]
  → POST /api/approval_replies { inbox_item_id, decision, message }
  → PUT /api/inbox_items/{id} { status: "replied" }
  → Modal closes with success animation
  → InboxCard updates: removes blue border, shows ✅
  → Reply delivered to worker via tmux send-keys (backend handles)
```

### 6.4 Refresh / Polling

```
On panel mount:
  → Fetch all data: GET /api/worker_sessions + /api/inbox_items + /api/activity_events
  → Subsequent polling: every 5 seconds (configurable)
  → SSE optional: connect to /api/events/stream for real-time updates

Manual refresh:
  → User clicks [⟳] in PanelHeader
  → Spinner animation on icon (rotate 360° over 500ms)
  → Re-fetch all endpoints
```

---

## 7. Data Fetching & Hooks

### 7.1 Hook Architecture

```typescript
// All hooks use Butler API at http://localhost:9999/api
// TmuxWeb server proxies: /api/butler/* → localhost:9999/api/*

useWorkerSessions(studyId?: string)
  → GET /api/worker_sessions?study_id={studyId}
  → Returns: WorkerSession[], loading, error, refetch
  → Poll: 5s interval

useInboxItems(filters?: { study_id?, status?, kind? })
  → GET /api/inbox_items?{filters}
  → Returns: InboxItem[], unreadCount, loading, error, refetch
  → Poll: 5s interval

useActivityEvents(studyId?: string, limit?: number)
  → GET /api/activity_events?study_id={studyId}&limit={limit}
  → Returns: ActivityEvent[], loading, error, refetch
  → Poll: 10s interval (less frequent — historical data)

useReplyInbox()
  → POST /api/approval_replies + PUT /api/inbox_items/{id}
  → Returns: submitReply(inboxItemId, decision, message), loading, error

useImperialStudies()
  → GET /api/imperial_studies?status=active
  → Returns: ImperialStudy[], loading, error
  → Used by PanelHeader to show study context
```

### 7.2 API Proxy Route (Server-side)

```javascript
// server/routes/butler-proxy.js (new)
// Proxies /api/butler/* to localhost:9999/api/*
// Avoids CORS issues, keeps Butler port internal

router.all('/butler/*', async (req, res) => {
  const targetUrl = `http://localhost:9999/api/${req.params[0]}`;
  // proxy request...
});
```

---

## 8. Color Reference (Complete Mapping)

### 8.1 Semantic Color Tokens

| Semantic Use         | CSS Variable             | Hex         |
|----------------------|--------------------------|-------------|
| Panel background     | var(--zinc-900)          | #18181b     |
| Card background      | var(--zinc-900)          | #18181b     |
| Card hover           | var(--blue-900-20)       | rgba(30,58,95,0.2) |
| Borders              | var(--zinc-800)          | #27272a     |
| Section header text  | var(--zinc-400)          | #a1a1aa     |
| Body text            | var(--zinc-200)          | #e4e4e7     |
| Secondary text       | var(--zinc-400)          | #a1a1aa     |
| Muted text           | var(--zinc-500)          | #71717a     |
| Timestamp text       | var(--zinc-600)          | #52525b     |
| Active/accent        | var(--blue-500)          | #3b82f6     |
| Success              | var(--green-500)         | #22c55e     |
| Warning              | var(--amber-500)         | #f59e0b     |
| Error                | var(--red-400)           | #f87171     |
| Waiting/launching    | var(--yellow-500)        | (implied)   |
| Disabled/exited      | var(--zinc-600)          | #52525b     |

### 8.2 Button Styles

| Button Type  | Background       | Text    | Hover                    |
|-------------|------------------|---------|--------------------------|
| Approve     | var(--green-500)  | white  | brightness(1.1)          |
| Reject      | var(--red-400)    | white  | brightness(1.1)          |
| Reply       | var(--blue-500)   | white  | var(--blue-400)          |
| Secondary   | var(--zinc-800)   | var(--zinc-200) | var(--zinc-700)  |
| Icon button | transparent       | var(--zinc-500) | var(--zinc-300)  |

---

## 9. Typography

| Element            | Size      | Weight | Line Height |
|--------------------|-----------|--------|-------------|
| Panel title        | 14px      | 600    | 1.3         |
| Section label      | 0.8rem    | 500    | 1.2         |
| Worker name        | 13px      | 500    | 1.3         |
| Inbox title        | 13px      | 400    | 1.4         |
| State label        | 0.7rem    | 500    | 1           |
| Metadata           | 0.7rem    | 400    | 1.2         |
| Timestamp          | 0.7rem    | 400    | 1           |
| Modal body         | 14px      | 400    | 1.5         |
| Button text        | 0.875rem  | 500    | 1           |

Font stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
Monospace (ports, times): `'SF Mono', 'Fira Code', 'Cascadia Code', monospace`

---

## 10. Responsive Considerations

### 10.1 Sidebar Width Constraints

The sidebar is fixed at 220px. All components must work within this constraint:

- Worker names: truncate with ellipsis at ~140px
- Inbox titles: max 2 lines, then ellipsis
- Activity summaries: single line, truncate
- No horizontal scrolling

### 10.2 Collapsible Sections

Each section (Workers, Inbox, Activity) is independently collapsible:

- Default state: Workers expanded, Inbox expanded, Activity collapsed
- Collapse state persisted in localStorage
- Smooth height animation: 200ms ease-out
- Collapsed shows only SectionHeader (32px)

### 10.3 Empty States

| Section   | Empty Message                         |
|-----------|---------------------------------------|
| Workers   | "No active workers" (var(--zinc-500), centered, italic) |
| Inbox     | "Inbox empty" (var(--zinc-500), centered, italic)       |
| Activity  | "No recent activity" (var(--zinc-500), centered, italic)|

### 10.4 Mobile (TmuxWeb MobileApp)

On mobile (`/m` route), the plugin renders as a full-screen panel (replaces terminal):

- Activity Bar becomes bottom tab bar (existing pattern)
- 御書房 tab added to bottom bar
- Panel fills full width/height
- InboxDetailModal becomes full-screen sheet (slide up from bottom)
- Worker click → switch to terminal view (not side-by-side)

---

## 11. Animation & Transitions

| Element                | Animation                              |
|------------------------|----------------------------------------|
| Panel content swap     | opacity 0→1, 150ms ease-in            |
| Section collapse       | height transition, 200ms ease-out      |
| Card hover highlight   | background transition, 100ms           |
| Worker click feedback  | 200ms blue flash (bg: var(--blue-500) 20% → 0%) |
| Modal open             | opacity 0→1 + translateY(8px→0), 200ms ease-out |
| Modal close            | opacity 1→0, 150ms ease-in            |
| Refresh spinner        | rotate 0→360deg, 500ms linear          |
| Badge pulse            | scale 1→1.2→1, 300ms, on new inbox item |
| Unread dot (Activity Bar) | opacity pulse 0.6→1→0.6, 2s infinite |

---

## 12. File Structure (Implementation Reference)

```
plugins/imperial-study/          ← .gitignored (private)
├── index.ts                     ← registerSidebarPlugin() call
├── ImperialStudyPanel.tsx       ← Plugin root component
├── components/
│   ├── PanelHeader.tsx
│   ├── WorkerSection.tsx
│   ├── WorkerCard.tsx
│   ├── InboxSection.tsx
│   ├── InboxCard.tsx
│   ├── InboxDetailModal.tsx
│   ├── ActivitySection.tsx
│   ├── ActivityRow.tsx
│   ├── SectionHeader.tsx
│   └── WorkerContextMenu.tsx
├── hooks/
│   ├── useWorkerSessions.ts
│   ├── useInboxItems.ts
│   ├── useActivityEvents.ts
│   ├── useReplyInbox.ts
│   └── useImperialStudies.ts
├── styles/
│   └── imperial-study.css       ← All plugin styles (scoped)
├── types.ts                     ← TypeScript interfaces (from §context)
└── constants.ts                 ← Color maps, polling intervals
```

---

## Appendix A: TypeScript Interfaces

```typescript
// types.ts — Mirrors Butler backend models

type StudyStatus = "active" | "paused" | "archived";
type WorkerState = "launching" | "idle" | "busy" | "exited" | "error";
type InboxKind = "question" | "approval" | "report" | "error" | "completion";
type InboxStatus = "pending" | "read" | "replied" | "dismissed";
type ReplyDecision = "approved" | "rejected" | "custom";
type ActivityType =
  | "worker_launched" | "worker_exited"
  | "task_started" | "task_completed" | "task_failed"
  | "inbox_received" | "reply_sent"
  | "study_created" | "study_paused" | "study_archived";

interface ImperialStudy {
  id: string;
  title: string;
  description: string;
  status: StudyStatus;
  config: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

interface WorkerSession {
  id: string;
  study_id: string;
  session_id: string;
  pane_target: string;
  port: number;
  state: WorkerState;
  run_id: string;
  project: string;
  workdir: string;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface InboxItem {
  id: string;
  study_id: string;
  worker_id: string;
  run_id: string;
  kind: InboxKind;
  status: InboxStatus;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

interface ApprovalReply {
  id: string;
  inbox_item_id: string;
  decision: ReplyDecision;
  message: string;
  delivered: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface ActivityEvent {
  id: string;
  study_id: string;
  worker_id: string;
  event_type: ActivityType;
  summary: string;
  detail: string;
  created_at: string | null;
}
```

---

## Appendix B: API Endpoint Reference

| Method | Endpoint                     | Purpose                    |
|--------|------------------------------|----------------------------|
| GET    | /api/imperial_studies        | List studies               |
| GET    | /api/worker_sessions         | List workers (filter: study_id, state) |
| GET    | /api/inbox_items             | List inbox (filter: study_id, status, kind) |
| GET    | /api/activity_events         | List events (filter: study_id, event_type) |
| POST   | /api/approval_replies        | Submit reply               |
| PUT    | /api/inbox_items/{id}        | Update inbox status        |
| GET    | /api/events/stream           | SSE for real-time updates  |
