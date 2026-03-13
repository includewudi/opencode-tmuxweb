const express = require('express');
const router = express.Router();

const CAPABILITIES_MANIFEST = {
  version: '1',
  project: {
    name: 'tmuxweb',
    description: 'Web-based tmux client with AI command generation, task tracking, and voice input',
    runtime: 'node',
    base_url: null,
  },
  capabilities: [
    {
      id: 'tmuxweb.terminal.manage',
      name: 'Terminal Management',
      description: 'CRUD operations on tmux sessions, windows, and panes — list, create, kill, rename, send keys',
      keywords: ['tmux', 'terminal', 'session', 'pane', 'window', 'pty'],
      when_to_use: 'When the user wants to manage tmux sessions, windows, or panes — list, create, kill, rename, or send commands',
      input_schema: { type: 'object', properties: { action: { type: 'string' }, target: { type: 'string' } } },
      actions: [
        { type: 'http', http: { method: 'GET', path: '/api/tmux/sessions' } },
        { type: 'http', http: { method: 'GET', path: '/api/tmux/panes' } },
        { type: 'http', http: { method: 'POST', path: '/api/tmux/send-keys' } },
      ],
    },
    {
      id: 'tmuxweb.task.track',
      name: 'Task Tracking',
      description: 'Track AI task lifecycle — create, complete, query tasks per pane with SSE real-time events',
      keywords: ['task', 'track', 'status', 'sse', 'event'],
      when_to_use: 'When tracking AI agent tasks — creation, completion, progress, or subscribing to real-time task events',
      input_schema: { type: 'object', properties: { pane_key: { type: 'string' }, event: { type: 'string' } } },
      actions: [
        { type: 'http', http: { method: 'POST', path: '/api/tasks/events' } },
        { type: 'http', http: { method: 'GET', path: '/api/panes/:paneKey/tasks' } },
        { type: 'http', http: { method: 'POST', path: '/api/tasks/:id/complete' } },
      ],
    },
    {
      id: 'tmuxweb.pane.status',
      name: 'Pane Status Management',
      description: 'Get and update pane working status — idle, in_progress, done, failed',
      keywords: ['pane', 'status', 'idle', 'busy', 'working'],
      when_to_use: 'When checking or updating the working status of a specific tmux pane',
      input_schema: { type: 'object', properties: { pane_key: { type: 'string' }, status: { type: 'string' } } },
      actions: [
        { type: 'http', http: { method: 'GET', path: '/api/panes/:paneKey/status' } },
        { type: 'http', http: { method: 'PUT', path: '/api/panes/:paneKey/status' } },
      ],
    },
    {
      id: 'tmuxweb.ai.command',
      name: 'AI Command Generation',
      description: 'Generate terminal commands from natural language using LLM with configurable roles',
      keywords: ['ai', 'command', 'generate', 'llm', 'role', 'prompt'],
      when_to_use: 'When the user wants AI to generate a terminal command from a natural language description',
      input_schema: { type: 'object', properties: { prompt: { type: 'string' }, role: { type: 'string' } }, required: ['prompt'] },
      actions: [
        { type: 'http', http: { method: 'POST', path: '/api/ai/command' } },
      ],
    },
    {
      id: 'tmuxweb.voice.input',
      name: 'Voice Input',
      description: 'Speech-to-text via Xunfei (iFlytek) WebSocket — hold-to-record with waveform visualization',
      keywords: ['voice', 'speech', 'stt', 'xunfei', 'microphone'],
      when_to_use: 'When the user wants to use voice input to dictate commands or text',
      input_schema: { type: 'object', properties: { audio: { type: 'string', description: 'WebSocket audio stream' } } },
      actions: [
        { type: 'websocket', websocket: { path: '/ws/speech' } },
      ],
    },
    {
      id: 'tmuxweb.snippet.manage',
      name: 'Command Snippets',
      description: 'Save, load, delete frequently used command snippets',
      keywords: ['snippet', 'command', 'save', 'favorite', 'template'],
      when_to_use: 'When managing saved command snippets — create, list, update, or delete',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, command: { type: 'string' } } },
      actions: [
        { type: 'http', http: { method: 'GET', path: '/api/snippets' } },
        { type: 'http', http: { method: 'POST', path: '/api/snippets' } },
        { type: 'http', http: { method: 'DELETE', path: '/api/snippets/:id' } },
      ],
    },
    {
      id: 'tmuxweb.profile.manage',
      name: 'Profile Management',
      description: 'Multi-profile support with groups and ordering — manage terminal workspace configurations',
      keywords: ['profile', 'group', 'workspace', 'layout', 'ordering'],
      when_to_use: 'When managing workspace profiles — create, switch, reorder, or group terminal configurations',
      input_schema: { type: 'object', properties: { profile_id: { type: 'string' } } },
      actions: [
        { type: 'http', http: { method: 'GET', path: '/api/profiles' } },
        { type: 'http', http: { method: 'POST', path: '/api/profiles' } },
        { type: 'http', http: { method: 'PUT', path: '/api/profiles/:id' } },
      ],
    },
    {
      id: 'tmuxweb.butler.proxy',
      name: 'Butler Proxy',
      description: 'Reverse proxy to Butler orchestration service — dispatch tasks, check progress',
      keywords: ['butler', 'orchestrate', 'dispatch', 'proxy', 'task'],
      when_to_use: 'When forwarding requests to Butler for task orchestration, research, or article generation',
      input_schema: { type: 'object', properties: { message: { type: 'string' } } },
      actions: [
        { type: 'http', http: { method: 'POST', path: '/api/butler/orchestrate' } },
        { type: 'http', http: { method: 'GET', path: '/api/butler/runs/:id/progress' } },
      ],
    },
  ],
  endpoints: [
    { method: 'GET', path: '/health', auth: false, description: 'Health check' },
    { method: 'GET', path: '/healthz', auth: false, description: 'Health check with DB status' },
    { method: 'GET', path: '/api/capabilities', auth: false, description: 'This endpoint — project self-awareness manifest' },
    { method: 'POST', path: '/api/auth/login', auth: false, description: 'Token authentication' },
    { method: 'GET', path: '/api/tmux/sessions', auth: true, description: 'List tmux sessions' },
    { method: 'GET', path: '/api/tmux/panes', auth: true, description: 'List panes in a session' },
    { method: 'POST', path: '/api/tmux/send-keys', auth: true, description: 'Send keys to a pane' },
    { method: 'POST', path: '/api/tasks/events', auth: false, description: 'Task lifecycle events (SSE)' },
    { method: 'GET', path: '/api/panes/:paneKey/tasks', auth: true, description: 'List tasks for a pane' },
    { method: 'POST', path: '/api/tasks/:id/complete', auth: true, description: 'Mark task as complete' },
    { method: 'GET', path: '/api/panes/:paneKey/status', auth: true, description: 'Get pane status' },
    { method: 'PUT', path: '/api/panes/:paneKey/status', auth: true, description: 'Update pane status' },
    { method: 'POST', path: '/api/ai/command', auth: true, description: 'AI command generation' },
    { method: 'GET', path: '/api/roles', auth: true, description: 'List AI roles' },
    { method: 'POST', path: '/api/roles', auth: true, description: 'Create custom AI role' },
    { method: 'GET', path: '/api/snippets', auth: true, description: 'List command snippets' },
    { method: 'POST', path: '/api/snippets', auth: true, description: 'Create snippet' },
    { method: 'DELETE', path: '/api/snippets/:id', auth: true, description: 'Delete snippet' },
    { method: 'GET', path: '/api/profiles', auth: true, description: 'List profiles' },
    { method: 'POST', path: '/api/profiles', auth: true, description: 'Create profile' },
    { method: 'PUT', path: '/api/profiles/:id', auth: true, description: 'Update profile' },
    { method: 'GET', path: '/api/groups', auth: true, description: 'List groups' },
    { method: 'POST', path: '/api/butler/orchestrate', auth: true, description: 'Butler orchestration proxy' },
    { method: 'WS', path: '/ws/terminal', auth: true, description: 'Terminal PTY WebSocket' },
    { method: 'WS', path: '/ws/speech', auth: true, description: 'Speech STT WebSocket' },
  ],
};

router.get('/', (req, res) => {
  const manifest = {
    ...CAPABILITIES_MANIFEST,
    project: {
      ...CAPABILITIES_MANIFEST.project,
      base_url: `${req.protocol}://${req.get('host')}`,
    },
  };
  res.json(manifest);
});

module.exports = router;
