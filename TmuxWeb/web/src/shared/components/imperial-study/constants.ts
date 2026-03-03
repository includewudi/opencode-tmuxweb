// constants.ts — Color maps, polling intervals, icon maps
import type { WorkerState, InboxKind } from './types';

// ── Worker State Colors ──────────────────────────────────────────────────────
export const WORKER_STATE_DOT_COLOR: Record<WorkerState, string> = {
    launching: 'var(--yellow-500, #eab308)',
    idle: 'var(--amber-500,  #f59e0b)',
    busy: 'var(--green-500,  #22c55e)',
    exited: 'var(--zinc-600,   #52525b)',
    error: 'var(--red-400,    #f87171)',
};

export const WORKER_STATE_LABEL_COLOR: Record<WorkerState, string> = {
    launching: 'var(--yellow-500, #eab308)',
    idle: 'var(--zinc-400,   #a1a1aa)',
    busy: 'var(--green-500,  #22c55e)',
    exited: 'var(--zinc-500,   #71717a)',
    error: 'var(--red-400,    #f87171)',
};

// ── Inbox Kind → Lucide Icon Name + Color ────────────────────────────────────
export const INBOX_KIND_CONFIG: Record<InboxKind, { icon: string; color: string }> = {
    question: { icon: 'HelpCircle', color: 'var(--blue-500,  #3b82f6)' },
    approval: { icon: 'ShieldCheck', color: 'var(--amber-500, #f59e0b)' },
    report: { icon: 'FileText', color: 'var(--zinc-400,  #a1a1aa)' },
    error: { icon: 'AlertTriangle', color: 'var(--red-400,   #f87171)' },
    completion: { icon: 'CheckCircle2', color: 'var(--green-500, #22c55e)' },
};

// ── Polling Intervals (ms) ───────────────────────────────────────────────────
export const POLL_WORKERS_MS = 5_000;
export const POLL_INBOX_MS = 5_000;
export const POLL_ACTIVITY_MS = 10_000;

// ── Butler API Base URL (proxied by TmuxWeb) ─────────────────────────────────
export const BUTLER_API_BASE = '/api/butler';
