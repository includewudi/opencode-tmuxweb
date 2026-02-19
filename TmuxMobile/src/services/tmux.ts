import { PtyType } from '@dylankenneally/react-native-ssh-sftp';
import { TmuxSession, TmuxWindow } from '../types';
import sshService from './ssh';
import remoteLogger from './remoteLogger';

export interface TmuxPane {
  id: string;
  index: number;
  active: boolean;
}

const SHELL_PREFIX = 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && ';

class TmuxService {
  async listSessions(serverId: number): Promise<TmuxSession[]> {
    let output: string;
    try {
      output = await sshService.execute(
        serverId,
        SHELL_PREFIX + 'tmux list-sessions -F "#{session_id}:#{session_name}:#{session_windows}:#{session_attached}"'
      );
    } catch (error) {
      remoteLogger.error('TmuxService', 'listSessions failed', { error: String(error) });
      throw error;
    }

    if (!output || output.includes('no server running')) {
      return [];
    }

    const sessions: TmuxSession[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      if (!line) continue;

      const [id, name, windowCount, attached] = line.split(':');
      const windows = await this.listWindows(serverId, name);

      sessions.push({
        id,
        name,
        windows: parseInt(windowCount, 10),
        active: attached === '1',
        structure: windows,
      });
    }

    return sessions;
  }

  async listWindows(serverId: number, sessionName: string): Promise<TmuxWindow[]> {
    const output = await sshService.execute(
      serverId,
      SHELL_PREFIX + `tmux list-windows -t "${sessionName}" -F "#{window_id}:#{window_index}:#{window_name}:#{window_panes}"`
    );

    if (!output) {
      return [];
    }

    const windows: TmuxWindow[] = [];

    for (const line of output.trim().split('\n')) {
      if (!line) continue;

      const [id, index, name, panes] = line.split(':');

      windows.push({
        id,
        index: parseInt(index, 10),
        name,
        panes: parseInt(panes, 10),
      });
    }

    return windows;
  }

  async createSession(serverId: number, name: string): Promise<boolean> {
    try {
      await sshService.execute(serverId, SHELL_PREFIX + `tmux new-session -d -s "${name}"`);
      return true;
    } catch {
      return false;
    }
  }

  async killSession(serverId: number, sessionName: string): Promise<boolean> {
    try {
      await sshService.execute(serverId, SHELL_PREFIX + `tmux kill-session -t "${sessionName}"`);
      return true;
    } catch {
      return false;
    }
  }

  async createWindow(serverId: number, sessionName: string, windowName: string): Promise<boolean> {
    try {
      await sshService.execute(
        serverId,
        SHELL_PREFIX + `tmux new-window -t "${sessionName}" -n "${windowName}"`
      );
      return true;
    } catch {
      return false;
    }
  }

  async killWindow(serverId: number, target: string): Promise<boolean> {
    try {
      await sshService.execute(serverId, SHELL_PREFIX + `tmux kill-window -t "${target}"`);
      return true;
    } catch {
      return false;
    }
  }

  async attachToSession(serverId: number, sessionName: string): Promise<void> {
    remoteLogger.log('TmuxService', 'attachToSession', { serverId, sessionName });
    await sshService.startShell(serverId, PtyType.XTERM);
    await new Promise(resolve => setTimeout(resolve, 500));
    const cmd = `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && tmux attach -t "${sessionName}"\n`;
    remoteLogger.log('TmuxService', 'sending command', { cmd });
    await sshService.writeToShell(serverId, cmd);
  }

  async attachToWindow(
    serverId: number,
    sessionName: string,
    windowIndex: number,
    cols: number = 80,
    rows: number = 24
  ): Promise<void> {
    remoteLogger.log('TmuxService', 'attachToWindow', { serverId, sessionName, windowIndex, cols, rows });
    await sshService.startShell(serverId, PtyType.XTERM);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const cmd = `stty cols ${cols} rows ${rows}; export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && tmux attach -t "${sessionName}:${windowIndex}"\n`;
    remoteLogger.log('TmuxService', 'sending command', { cmd });
    await sshService.writeToShell(serverId, cmd);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    await sshService.writeToShell(serverId, `\x02:refresh-client -C ${cols},${rows}\r`);
    remoteLogger.log('TmuxService', 'sent refresh-client', { cols, rows });
  }

  async sendKeys(serverId: number, target: string, keys: string): Promise<void> {
    await sshService.execute(serverId, SHELL_PREFIX + `tmux send-keys -t "${target}" "${keys}"`);
  }

  async sendKeysLiteral(serverId: number, target: string, keys: string): Promise<void> {
    await sshService.execute(serverId, SHELL_PREFIX + `tmux send-keys -t "${target}" -l "${keys}"`);
  }

  async selectWindow(serverId: number, sessionName: string, windowIndex: number): Promise<void> {
    remoteLogger.log('TmuxService', 'selectWindow', { serverId, sessionName, windowIndex });
    await sshService.writeToShell(serverId, `\x02:select-window -t ${windowIndex}\r`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async detach(serverId: number): Promise<void> {
    await sshService.writeToShell(serverId, '\x02d');
  }

  async getServerStats(serverId: number): Promise<{ cpu: string; ram: string }> {
    try {
      const cpuOutput = await sshService.execute(
        serverId,
        "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"
      );

      const ramOutput = await sshService.execute(
        serverId,
        "free | grep Mem | awk '{printf \"%.0f\", $3/$2 * 100}'"
      );

      return {
        cpu: `${parseFloat(cpuOutput.trim()).toFixed(0)}%`,
        ram: `${ramOutput.trim()}%`,
      };
    } catch {
      return { cpu: 'N/A', ram: 'N/A' };
    }
  }
}

export const tmuxService = new TmuxService();
export default tmuxService;
