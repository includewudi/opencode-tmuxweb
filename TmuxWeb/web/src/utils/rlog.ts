const LOG_ENDPOINT = '/api/log'

function send(level: string, message: string, data?: unknown) {
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  consoleFn(`[Remote] ${message}`, data || '')

  try {
    const ua = navigator.userAgent
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
    }).catch(() => {})
  } catch {
    void 0
  }
}

const rlog = {
  info: (msg: string, data?: unknown) => send('info', msg, data),
  warn: (msg: string, data?: unknown) => send('warn', msg, data),
  error: (msg: string, data?: unknown) => send('error', msg, data),
}

export default rlog
