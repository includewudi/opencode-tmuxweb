// helpers.ts — Shared utility functions for ProjectOverview
import type { ProjectSummary } from './types';

export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    return `${Math.floor(days / 30)}个月前`;
}

export function projectName(project: ProjectSummary): string {
    if (project.name) return project.name;
    const segs = project.path.split('/').filter(Boolean);
    return segs.length >= 2 ? segs.slice(-2).join('/') : segs[segs.length - 1] || project.path;
}

export function stripSystemContent(msg: string | null): string | null {
    if (!msg) return null;
    if (msg.includes('<system-reminder>') || msg.includes('<command-instruction>')) return null;
    return msg;
}
