import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { Server } from '../types';
import {
  storePassword,
  getPassword,
  storeHostKey,
  verifyHostKey,
} from '../storage/secureStorage';

const { RNSSHModule } = NativeModules;

function base64Decode(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  const input = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));
    
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    
    result += String.fromCharCode(chr1);
    if (enc3 !== 64) result += String.fromCharCode(chr2);
    if (enc4 !== 64) result += String.fromCharCode(chr3);
  }
  
  return result;
}

export interface TofuResult {
  type: 'first_connect' | 'match' | 'mismatch';
  fingerprint: string;
}

export interface TofuCallbacks {
  onFirstConnect: (fingerprint: string) => Promise<boolean>;
  onMismatch: (fingerprint: string) => Promise<boolean>;
}

type DataCallback = (data: string) => void;
type ErrorCallback = (error: string) => void;
type DisconnectCallback = (reason: string) => void;

class NativeSSHService {
  private eventEmitter: NativeEventEmitter | null = null;
  private subscriptions: { [key: string]: any } = {};
  private dataCallbacks: DataCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private disconnectCallbacks: DisconnectCallback[] = [];

  constructor() {
    if (Platform.OS === 'ios' && RNSSHModule) {
      this.eventEmitter = new NativeEventEmitter(RNSSHModule);
      this.setupListeners();
    }
  }

  private setupListeners() {
    if (!this.eventEmitter) return;

    this.subscriptions.data = this.eventEmitter.addListener('onData', (event) => {
      const decoded = base64Decode(event.data);
      this.dataCallbacks.forEach((cb) => cb(decoded));
    });

    this.subscriptions.error = this.eventEmitter.addListener('onError', (event) => {
      this.errorCallbacks.forEach((cb) => cb(event.error));
    });

    this.subscriptions.disconnect = this.eventEmitter.addListener('onDisconnect', (event) => {
      this.disconnectCallbacks.forEach((cb) => cb(event.reason));
    });
  }

  onData(callback: DataCallback): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      const idx = this.dataCallbacks.indexOf(callback);
      if (idx > -1) this.dataCallbacks.splice(idx, 1);
    };
  }

  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const idx = this.errorCallbacks.indexOf(callback);
      if (idx > -1) this.errorCallbacks.splice(idx, 1);
    };
  }

  onDisconnect(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.push(callback);
    return () => {
      const idx = this.disconnectCallbacks.indexOf(callback);
      if (idx > -1) this.disconnectCallbacks.splice(idx, 1);
    };
  }

  async connectWithTofu(
    server: Server,
    tofuCallbacks: TofuCallbacks
  ): Promise<boolean> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }

    const { ip: host, port, user } = server;
    const password = server.credentials?.password;

    if (!password) {
      throw new Error('Password authentication required');
    }

    const handshakeResult = await RNSSHModule.handshake(host, port);
    const fingerprint = handshakeResult.fingerprint;

    const verifyResult = await verifyHostKey(host, port, user, fingerprint);

    if (verifyResult === 'not_found') {
      const accepted = await tofuCallbacks.onFirstConnect(fingerprint);
      if (!accepted) {
        await this.disconnect();
        return false;
      }
      await storeHostKey(host, port, user, fingerprint);
    } else if (verifyResult === 'mismatch') {
      const accepted = await tofuCallbacks.onMismatch(fingerprint);
      if (!accepted) {
        await this.disconnect();
        return false;
      }
    }

    await RNSSHModule.authenticate(user, password);
    return true;
  }

  async connect(
    host: string,
    port: number,
    username: string,
    password: string
  ): Promise<{ fingerprint: string }> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }
    return await RNSSHModule.handshake(host, port);
  }

  async authenticate(username: string, password: string): Promise<boolean> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }
    await RNSSHModule.authenticate(username, password);
    return true;
  }

  async disconnect(): Promise<void> {
    if (!RNSSHModule) return;
    await RNSSHModule.disconnect();
  }

  async startTmuxControlMode(sessionName?: string): Promise<void> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }
    await RNSSHModule.startTmuxControlMode(sessionName || '', 0);
  }

  async startCommand(command: string): Promise<void> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }
    await RNSSHModule.startCommand(command);
  }

  async write(data: string): Promise<void> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }
    await RNSSHModule.write(data);
  }

  async resize(cols: number, rows: number): Promise<void> {
    if (!RNSSHModule) {
      throw new Error('Native SSH module not available');
    }
    await RNSSHModule.resize(cols, rows);
  }

  async storeCredential(server: Server): Promise<void> {
    const { ip: host, port, user, credentials } = server;
    if (credentials?.password) {
      await storePassword(host, port, user, credentials.password);
    }
  }

  async getStoredPassword(
    host: string,
    port: number,
    user: string
  ): Promise<string | null> {
    return await getPassword(host, port, user);
  }

  cleanup() {
    Object.values(this.subscriptions).forEach((sub) => sub?.remove());
    this.subscriptions = {};
    this.dataCallbacks = [];
    this.errorCallbacks = [];
    this.disconnectCallbacks = [];
  }
}

export const nativeSSHService = new NativeSSHService();
export default nativeSSHService;
