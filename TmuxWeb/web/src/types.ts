export interface TmuxPane {
  paneId: string
  paneTitle: string
  paneCommand: string
}

export interface TmuxWindow {
  windowIndex: number
  windowName: string
  windowId: string
  panes: TmuxPane[]
}

export interface TmuxSession {
  sessionName: string
  sessionId: string
  windows: TmuxWindow[]
}

export interface OpenTab {
  id: string
  paneId: string
  title: string
}

export interface Profile {
  id: number
  profile_key: string
  name: string
  sort_order: number
}

export interface SessionGroup {
  id: number
  group_name: string
  sort_order: number
  session_count: number
}

export type PaneStatus = 'idle' | 'in_progress' | 'done' | 'failed' | 'waiting'

export interface PaneStatusInfo {
  paneKey: string
  status: PaneStatus
  mtime: number
}

export interface Task {
  id: number
  task_title: string
  task_status: 'in_progress' | 'completed'
  started_at: number
  completed_at: number
  paneKey: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  msg_time: number
}

export interface CommandRecord {
  id: number
  command: string
  cmd_time: number
  exit_code: number
}

export interface TaskSummary {
  id: number
  command_summary: string | null
  output_summary: string | null
  summary_status: 'pending' | 'running' | 'done' | 'error'
}

export interface TaskDetail extends Task {
  conversation: ChatMessage[]
  commands: CommandRecord[]
  summary: TaskSummary | null
}

export interface AiConversation {
  conversation_id: string
  pane_key: string
  user_message: string
  assistant_message: string
  conv_status: 'in_progress' | 'completed' | 'aborted' | 'failed' | 'waiting'
  started_at: number
  completed_at: number | null
}
