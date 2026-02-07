import { PtyType } from '@dylankenneally/react-native-ssh-sftp';
import sshService from '../../services/ssh';
import { TmuxCcParser } from './tmuxCcParser';

const SHELL_PREFIX = 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && ';

export async function startTmuxCcAttach(
  serverId: number,
  target: string,
  onOutput: (paneId: string, text: string) => void
): Promise<() => void> {
  const parser = new TmuxCcParser();

  const unsubscribe = sshService.onShellOutput(serverId, (data: string) => {
    parser.push(data, (ev) => {
      if (ev.type === 'output') {
        onOutput(ev.paneId, ev.text);
      }
    });
  });

  await sshService.startShell(serverId, PtyType.XTERM);
  await new Promise((resolve) => setTimeout(resolve, 500));

  await sshService.writeToShell(serverId, `${SHELL_PREFIX}tmux -CC attach -t "${target}"\n`);

  return () => {
    unsubscribe();
    sshService.closeShell(serverId);
  };
}
