const LOG_SERVER_URL = 'http://172.29.15.223:9999/log';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info';
  tag: string;
  message: string;
  data?: unknown;
}

class RemoteLogger {
  private queue: LogEntry[] = [];
  private isSending = false;
  private enabled = true;

  private async sendBatch() {
    if (this.isSending || this.queue.length === 0) return;
    
    this.isSending = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      await fetch(LOG_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app: 'TmuxMobile',
          logs: batch,
        }),
      });
    } catch {
    } finally {
      this.isSending = false;
      if (this.queue.length > 0) {
        setTimeout(() => this.sendBatch(), 100);
      }
    }
  }

  private addLog(level: LogEntry['level'], tag: string, message: string, data?: unknown) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      tag,
      message,
      data,
    };

    this.queue.push(entry);
    
    const localMsg = `[${tag}] ${message}`;
    if (data !== undefined) {
      console[level](localMsg, data);
    } else {
      console[level](localMsg);
    }

    setTimeout(() => this.sendBatch(), 50);
  }

  log(tag: string, message: string, data?: unknown) {
    this.addLog('log', tag, message, data);
  }

  error(tag: string, message: string, data?: unknown) {
    this.addLog('error', tag, message, data);
  }

  warn(tag: string, message: string, data?: unknown) {
    this.addLog('warn', tag, message, data);
  }

  info(tag: string, message: string, data?: unknown) {
    this.addLog('info', tag, message, data);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const remoteLogger = new RemoteLogger();
export default remoteLogger;
