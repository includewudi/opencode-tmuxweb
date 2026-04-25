// types.ts — ProjectOverview TypeScript Interfaces
// Mirrors backend API responses from /api/project-overview/

export interface ProjectSummary {
    id: string;
    name: string | null;
    path: string;
    lastActivity: string | null;
    sessionCount: number;
    todoStats: { total: number; completed: number; pending: number };
    latestMessage: string | null;
    activePlan: string | null;
    completedPlans: string[];
}

export interface TodoItem {
    content: string;
    status: 'completed' | 'pending';
    priority: 'high' | 'medium' | 'low';
}

export interface RecentSession {
    id: string;
    title: string | null;
    timeUpdated: string | null;
    timeCreated: string | null;
    summaryAdditions: number;
    summaryDeletions: number;
    summaryFiles: number;
    latestUserMessage: string | null;
    latestAssistantMessage: string | null;
}

export interface PlanInfo {
    name: string;
    status: 'active' | 'completed';
}

export interface ProjectDetail {
    project: ProjectSummary;
    todos: TodoItem[];
    recentSessions: RecentSession[];
    plans: PlanInfo[];
}

export interface ProjectOverviewResponse {
    success: boolean;
    data: { projects: ProjectSummary[] };
}

export interface ProjectDetailResponse {
    success: boolean;
    data: ProjectDetail;
}

export interface GoalSession {
    id: string;
    title: string | null;
    agent: string | null;
    category: string | null;
    timeUpdated: string | null;
    firstUserMessage: string | null;
    summaryAdditions: number;
    summaryDeletions: number;
    summaryFiles: number;
}

export interface Goal {
    id: string;
    title: string;
    status: 'active' | 'completed';
    sessionCount: number;
    userMessages: number;
    assistantMessages: number;
    todoStats: { total: number; completed: number; pending: number };
    codeChanges: { additions: number; deletions: number; files: number };
    lastActivity: string | null;
    todos: TodoItem[];
    sessions: GoalSession[];
}

export interface ProjectGoalsResponse {
    success: boolean;
    data: {
        project: ProjectSummary;
        goals: Goal[];
    };
}
