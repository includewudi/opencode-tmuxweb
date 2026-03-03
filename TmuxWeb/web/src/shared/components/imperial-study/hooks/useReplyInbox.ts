import { useState } from 'react';
import type { ReplyDecision } from '../types';
import { BUTLER_API_BASE } from '../constants';

export function useReplyInbox() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const submitReply = async (
        inboxItemId: string,
        studyId: string,
        decision: ReplyDecision,
        message: string
    ) => {
        setLoading(true);
        setError(null);
        try {
            // 1. Post the approval reply record
            const replyRes = await fetch(`${BUTLER_API_BASE}/approval_replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inbox_item_id: inboxItemId, study_id: studyId, decision, message }),
            });
            if (!replyRes.ok) throw new Error(`Reply POST failed: HTTP ${replyRes.status}`);

            // 2. Mark inbox item as replied
            const updateRes = await fetch(`${BUTLER_API_BASE}/inbox_items/${inboxItemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'replied' }),
            });
            if (!updateRes.ok) throw new Error(`Status PUT failed: HTTP ${updateRes.status}`);
        } catch (e: any) {
            setError(e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { submitReply, loading, error };
}
