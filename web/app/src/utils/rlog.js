/**
 * Remote logger — sends client-side logs to /api/log for iOS debugging.
 * Logs are also printed to console as usual.
 */

const LOG_ENDPOINT = '/api/log';

function send(level, message, data) {
    // Console output
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[Remote] ${message}`, data || '');

    // Send to server (fire-and-forget)
    try {
        const ua = navigator.userAgent;
        fetch(LOG_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level,
                message,
                data,
                ua: ua.length > 80 ? ua.slice(0, 80) + '…' : ua,
                url: window.location.href,
            }),
        }).catch(() => { });
    } catch { }
}

const rlog = {
    info: (msg, data) => send('info', msg, data),
    warn: (msg, data) => send('warn', msg, data),
    error: (msg, data) => send('error', msg, data),
};

export default rlog;
