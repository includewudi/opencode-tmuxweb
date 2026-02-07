export interface ServerStats {
  cpu: string;
  ram: string;
}

export interface TmuxWindow {
  id: string;
  index: number;
  name: string;
  panes: number;
}

export interface TmuxSession {
  id: string;
  name: string;
  windows: number;
  active: boolean;
  structure: TmuxWindow[];
}

export type ConnectionStatus = 'connected' | 'disconnected';

export interface ServerCredentials {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface Server {
  id: number;
  name: string;
  ip: string;
  port: number;
  user: string;
  credentials?: ServerCredentials;
  status: ConnectionStatus;
  stats: ServerStats | null;
  sessions: TmuxSession[];
}

export type TerminalLineType = 'info' | 'prompt' | 'output' | 'success' | 'error' | 'cursor';

export interface TerminalLine {
  type: TerminalLineType;
  text: string;
  path?: string;
}

export type Screen = 'serverList' | 'serverDetail' | 'terminal';

export interface NavigationState {
  currentScreen: Screen;
  selectedServer: Server | null;
  selectedSession: TmuxSession | null;
  selectedWindow: TmuxWindow | null;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StatusBadgeProps {
  status: ConnectionStatus;
}

export interface HeaderProps {
  title: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onLeftClick?: () => void;
  onRightClick?: () => void;
}

export interface ServerCardProps {
  server: Server;
  onPress: (server: Server) => void;
}

export interface SessionTreeProps {
  sessions: TmuxSession[];
  expandedSessions: string[];
  onToggleSession: (id: string, event: any) => void;
  onSessionClick: (session: TmuxSession) => void;
  onWindowClick: (session: TmuxSession, window: TmuxWindow) => void;
}

export interface TerminalKeyboardProps {
  onKeyPress: (key: string) => void;
  onSpecialKey: (key: string) => void;
}

export interface AIAssistantPanelProps {
  visible: boolean;
  onClose: () => void;
  onCommandGenerated: (command: string) => void;
}
