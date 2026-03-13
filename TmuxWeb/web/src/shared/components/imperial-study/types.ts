// types.ts — 御書房 Plugin TypeScript Interfaces
// Mirrors Butler backend models (Appendix A)

export type StudyStatus = "active" | "paused" | "archived";
export type WorkerState = "launching" | "idle" | "busy" | "exited" | "error";
export type InboxKind = "question" | "approval" | "report" | "error" | "completion";
export type InboxStatus = "pending" | "read" | "replied" | "dismissed";
export type ReplyDecision = "approved" | "rejected" | "custom";
export type ActivityType =
    | "worker_launched" | "worker_exited"
    | "task_started" | "task_completed" | "task_failed"
    | "inbox_received" | "reply_sent"
    | "study_created" | "study_paused" | "study_archived";

export interface ImperialStudy {
    id: string;
    title: string;
    description: string;
    status: StudyStatus;
    config: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
}

export interface WorkerSession {
    id: string;
    study_id: string;
    session_id: string;   // alias / display name
    pane_target: string;  // tmux pane target, e.g. "butler/quant:%1"
    port: number;
    state: WorkerState;
    run_id: string;
    project: string;
    workdir: string;
    last_seen_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface InboxItem {
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

export interface ApprovalReply {
    id: string;
    inbox_item_id: string;
    decision: ReplyDecision;
    message: string;
    delivered: boolean;
    created_at: string | null;
    updated_at: string | null;
}

export interface ActivityEvent {
    id: string;
    study_id: string;
    worker_id: string;
    event_type: ActivityType;
    summary: string;
    detail: string;
    created_at: string | null;
}

// ── Run Detail (TaskDetailModal) ─────────────────────────────────────────────
export interface TaskRunDetail {
    id: string;
    task_id: string;
    state: string;
    trigger: string | null;
    attempt: number;
    input_data: {
        intent?: string;
        project?: string;
        sub_butler?: string;
    } | null;
    result: string | null;
    error: string | null;
    queued_at: string | null;
    started_at: string | null;
    ended_at: string | null;
    estimated_at: string | null;
}

export interface TaskEventDetail {
    id: number;
    run_id: string;
    event_type: string;
    payload: Record<string, unknown> | null;
    created_at: string;
}

export interface RunDetailResponse {
    success: boolean;
    data: TaskRunDetail;
}

export interface RunEventsResponse {
    success: boolean;
    data: { events: TaskEventDetail[] };
}

// ── Pipeline (Run Visualization) ────────────────────────────────────────────
export type PipelineStage = 'outflow' | 'processing' | 'return';
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed';

export interface RoutingInfo {
    strategy: string;     // "assistant" | "sub_butler" | "capability"
    executor: string;     // "opencode" | "tmux_relay" | etc
    cap_name?: string;    // capability name if matched
    pane_target?: string;
    delegated: boolean;
}

export interface PipelineRun {
    run_id: string;
    task_id?: string;
    intent: string;
    routing: RoutingInfo;
    stage: PipelineStage;
    status: PipelineStatus;
    events: ActivityEvent[];
    result?: string;
    startedAt: number;
}
