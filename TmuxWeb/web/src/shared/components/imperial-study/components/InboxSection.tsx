// InboxSection.tsx — Inbox collapsible section + InboxCard
import { useState } from 'react';
import {
    ChevronRight,
    HelpCircle,
    ShieldCheck,
    FileText,
    AlertTriangle,
    CheckCircle2,
    LucideIcon
} from 'lucide-react';
import type { InboxItem } from '../types';
import { INBOX_KIND_CONFIG } from '../constants';

const KIND_ICON_MAP: Record<string, LucideIcon> = {
    HelpCircle,
    ShieldCheck,
    FileText,
    AlertTriangle,
    CheckCircle2,
};

// ── InboxCard ────────────────────────────────────────────────────────────────
interface InboxCardProps {
    item: InboxItem;
    onClick: (item: InboxItem) => void;
}

function InboxCard({ item, onClick }: InboxCardProps) {
    const cfg = INBOX_KIND_CONFIG[item.kind];
    // fallback to FileText if not found
    const Icon = cfg ? KIND_ICON_MAP[cfg.icon] : FileText;
    const color = cfg ? cfg.color : 'var(--zinc-400)';

    return (
        <div
            className={`is-inbox-card ${item.status}`}
            onClick={() => onClick(item)}
            title="Click to view details"
        >
            <div className="is-inbox-card__row1">
                <Icon size={14} style={{ color }} />
                <span className="is-inbox-card__worker">{item.worker_id}</span>
            </div>
            <div className="is-inbox-card__title">{item.title}</div>
            {item.body && (
                <div className="is-inbox-body-preview">{item.body}</div>
            )}
            <div className="is-inbox-card__ts">
                {item.updated_at ? new Date(item.updated_at).toLocaleTimeString() : ''}
            </div>
        </div>
    );
}

// ── InboxSection ─────────────────────────────────────────────────────────────
interface InboxSectionProps {
    items: InboxItem[];
    onItemClick: (item: InboxItem) => void;
}

export function InboxSection({ items, onItemClick }: InboxSectionProps) {
    const [open, setOpen] = useState(true);

    return (
        <div className="is-section">
            <div className="is-section__header" onClick={() => setOpen(o => !o)}>
                <ChevronRight
                    size={14}
                    className={`is-section__chevron ${open ? 'open' : ''}`}
                />
                <span className="is-section__label">Inbox ({items.length})</span>
            </div>
            <div
                className={`is-section__body ${open ? '' : 'collapsed'}`}
                style={{ maxHeight: open ? `${items.length * 64 + 20}px` : '0' }}
            >
                {items.length === 0 ? (
                    <p className="is-empty">Inbox empty</p>
                ) : (
                    items.map(item => (
                        <InboxCard key={item.id} item={item} onClick={onItemClick} />
                    ))
                )}
            </div>
        </div>
    );
}
