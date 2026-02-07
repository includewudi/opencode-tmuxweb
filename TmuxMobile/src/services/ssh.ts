import SSHClient, { PtyType } from '@dylankenneally/react-native-ssh-sftp';
import { Server } from '../types';
import remoteLogger from './remoteLogger';

export type SSHEventCallback = (data: string) => void;
export type SSHErrorCallback = (error: Error) => void;

interface SSHConnection {
  client: SSHClient;
  server: Server;
  shellActive: boolean;
}

class SSHService {
  private connections: Map<number, SSHConnection> = new Map();
  private shellListeners: Map<number, SSHEventCallback[]> = new Map();
  private errorListeners: Map<number, SSHErrorCallback[]> = new Map();

  async connect(server: Server): Promise<boolean> {
    remoteLogger.log('SSHService', 'connect called', { id: server.id, ip: server.ip, user: server.user });
    
    if (this.connections.has(server.id)) {
      remoteLogger.log('SSHService', 'already connected');
      return true;
    }

    try {
      let client: SSHClient;

      if (server.credentials?.privateKey) {
        remoteLogger.log('SSHService', 'connecting with key');
        client = await SSHClient.connectWithKey(
          server.ip,
          server.port || 22,
          server.user,
          server.credentials.privateKey,
          server.credentials.passphrase || ''
        );
      } else if (server.credentials?.password) {
        remoteLogger.log('SSHService', 'connecting with password');
        client = await SSHClient.connectWithPassword(
          server.ip,
          server.port || 22,
          server.user,
          server.credentials.password
        );
      } else {
        throw new Error('No credentials provided');
      }

      this.connections.set(server.id, {
        client,
        server,
        shellActive: false,
      });

      remoteLogger.log('SSHService', 'connected successfully');
      return true;
    } catch (error) {
      remoteLogger.error('SSHService', 'connect failed', { error: String(error) });
      this.notifyError(server.id, error as Error);
      return false;
    }
  }

  async disconnect(serverId: number): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    try {
      if (connection.shellActive) {
        connection.client.closeShell();
      }
      connection.client.disconnect();
    } catch {
    } finally {
      this.connections.delete(serverId);
      this.shellListeners.delete(serverId);
      this.errorListeners.delete(serverId);
    }
  }

  isConnected(serverId: number): boolean {
    return this.connections.has(serverId);
  }

  async execute(serverId: number, command: string): Promise<string> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      remoteLogger.error('SSHService', 'execute failed - not connected', { serverId });
      throw new Error('Not connected to server');
    }

    remoteLogger.log('SSHService', 'execute', { command });
    try {
      const output = await connection.client.execute(command);
      remoteLogger.log('SSHService', 'execute result', { output });
      return output;
    } catch (error: unknown) {
      const errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        raw: JSON.stringify(error),
      };
      remoteLogger.error('SSHService', 'execute error', errorInfo);
      throw error;
    }
  }

  async startShell(serverId: number, termType: PtyType = PtyType.XTERM): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error('Not connected to server');
    }

    if (connection.shellActive) {
      remoteLogger.log('SSHService', 'shell already active, skipping startShell');
      return;
    }

    remoteLogger.log('SSHService', 'starting shell');
    await connection.client.startShell(termType);
    connection.shellActive = true;
    remoteLogger.log('SSHService', 'shell started');

    connection.client.on('Shell', (data: string) => {
      this.notifyShellOutput(serverId, data);
    });
  }

  async writeToShell(serverId: number, data: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.shellActive) {
      remoteLogger.error('SSHService', 'writeToShell failed - shell not active');
      throw new Error('Shell not active');
    }

    remoteLogger.log('SSHService', 'writeToShell', { data });
    await connection.client.writeToShell(data);
    remoteLogger.log('SSHService', 'writeToShell done');
  }

  closeShell(serverId: number): void {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.shellActive) return;

    try {
      connection.client.closeShell();
      connection.shellActive = false;
    } catch {
    }
  }

  onShellOutput(serverId: number, callback: SSHEventCallback): () => void {
    if (!this.shellListeners.has(serverId)) {
      this.shellListeners.set(serverId, []);
    }
    this.shellListeners.get(serverId)!.push(callback);

    return () => {
      const listeners = this.shellListeners.get(serverId);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  onError(serverId: number, callback: SSHErrorCallback): () => void {
    if (!this.errorListeners.has(serverId)) {
      this.errorListeners.set(serverId, []);
    }
    this.errorListeners.get(serverId)!.push(callback);

    return () => {
      const listeners = this.errorListeners.get(serverId);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  private notifyShellOutput(serverId: number, data: string): void {
    const listeners = this.shellListeners.get(serverId) || [];
    listeners.forEach((callback) => callback(data));
  }

  private notifyError(serverId: number, error: Error): void {
    const listeners = this.errorListeners.get(serverId) || [];
    listeners.forEach((callback) => callback(error));
  }

  getActiveConnections(): Server[] {
    return Array.from(this.connections.values()).map((c) => c.server);
  }
}

export const sshService = new SSHService();
export default sshService;
