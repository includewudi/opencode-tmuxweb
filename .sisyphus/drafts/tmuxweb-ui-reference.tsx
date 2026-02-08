import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  Settings, 
  LogOut, 
  ChevronRight, 
  ChevronDown, 
  MoreHorizontal, 
  Plus, 
  Play, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  Code, 
  FileText, 
  RefreshCw, 
  Layout, 
  List, 
  X,
  Menu,
  GripVertical,
  Folder,
  FolderOpen
} from 'lucide-react';

/**
 * MOCK DATA
 */
const MOCK_PROFILES = [
  { id: 'default', name: 'default' },
  { id: 'work', name: 'work-profile' },
];

const INITIAL_GROUPS = [
  { id: 'g1', title: 'AI Projects', sortOrder: 10 },
  { id: 'g2', title: 'DevOps', sortOrder: 30 },
];

const INITIAL_SESSIONS = [
  { id: 's1', groupId: null, title: 'dify', sortOrder: 10, windows: [
      { id: 'w1', name: '1:zsh', panes: [{ id: 'p1', name: '%1', status: 'idle' }] }
  ]},
  { id: 's2', groupId: 'g1', title: 'hsk', sortOrder: 10, windows: [
      { id: 'w2', name: '1:zsh', panes: [
          { id: 'p2', name: '%1', status: 'idle' },
          { id: 'p3', name: '%2', status: 'in-progress' },
          { id: 'p4', name: '%3', status: 'done' }
      ]}
  ]},
  { id: 's3', groupId: 'g1', title: 'omo', sortOrder: 20, windows: [
      { id: 'w3', name: '1:bash', panes: [{ id: 'p5', name: '%1', status: 'idle' }] }
  ]},
  { id: 's4', groupId: null, title: 'misc', sortOrder: 20, windows: [
      { id: 'w4', name: '1:zsh', panes: [{ id: 'p6', name: '%1', status: 'idle' }] }
  ]},
];

const MOCK_LOGS = {
  conversation: [
    { role: 'user', text: 'Please add login endpoint' },
    { role: 'assistant', text: "I'll create POST /api/auth/login..." }
  ],
  commands: [
    { cmd: 'npm install jsonwebtoken' },
    { cmd: 'curl -X POST localhost:8215/api/auth/login...' }
  ]
};

const MOCK_HISTORY = [
  { id: 122, title: 'Database setup', date: '2026-02-07' },
  { id: 121, title: 'Initial scaffold', date: '2026-02-06' }
];

/**
 * HELPER COMPONENTS
 */

const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyle = "flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white border border-transparent",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700",
    ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200",
    danger: "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900",
  };
  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    icon: "p-1.5",
  };
  
  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Badge = ({ status }) => {
  const styles = {
    'idle': 'bg-zinc-700 text-zinc-400',
    'in-progress': 'bg-blue-900/50 text-blue-400 border-blue-800',
    'done': 'bg-green-900/50 text-green-400 border-green-800',
  };
  const labels = {
    'idle': 'Idle',
    'in-progress': 'In Progress',
    'done': 'Done',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent ${styles[status] || styles.idle}`}>
      {labels[status]}
    </span>
  );
};

/**
 * LOGIN SCREEN
 */
const LoginScreen = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-mono text-zinc-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-500" /> 
            TmuxWeb
          </h1>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Enter Access Token</label>
            <input 
              type="password" 
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-3 text-sm focus:border-blue-500 focus:outline-none text-white placeholder-zinc-600"
              placeholder="sk-..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="remember" defaultChecked className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0" />
            <label htmlFor="remember" className="text-sm text-zinc-400">Remember me 30 days</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost">Cancel</Button>
            <Button onClick={onLogin}>Login</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * MAIN APP COMPONENT
 */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('terminal'); // For mobile: sessions, terminal, details
  const [showMobileSessions, setShowMobileSessions] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  
  // Data State
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [expandedNodes, setExpandedNodes] = useState({'g1': true, 's2': true, 'w2': true}); // Default expanded for demo
  const [activePane, setActivePane] = useState({ sessionId: 's2', windowId: 'w2', paneId: 'p3' });

  // Drag State
  const [draggedItem, setDraggedItem] = useState(null);

  const toggleExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogin = () => setIsLoggedIn(true);

  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} />;

  // --- Drag & Drop Logic (Simplified for Prototype) ---
  const handleDragStart = (e, item, type) => {
    setDraggedItem({ item, type });
    e.dataTransfer.effectAllowed = 'move';
    // Small timeout to allow the ghost image to form before we hide the source (optional)
  };

  const handleDrop = (e, targetId, targetType, isGroup) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Logic to move session into group or reorder
    if (draggedItem.type === 'session') {
       const updatedSessions = [...sessions];
       const sessionIndex = updatedSessions.findIndex(s => s.id === draggedItem.item.id);
       const session = updatedSessions[sessionIndex];

       if (isGroup) {
         // Dropped ON a group -> Move into group
         session.groupId = targetId;
         // Set sort order to end of group (mock logic)
         session.sortOrder = 999; 
       } else if (targetType === 'root') {
         // Dropped on root -> Ungroup
         session.groupId = null;
       }
       
       setSessions(updatedSessions);
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      
      {/* --- DESKTOP LAYOUT --- */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT SIDEBAR (Desktop) / DRAWER (Mobile) */}
        <aside className={`
          absolute z-30 inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-300
          md:relative md:translate-x-0
          ${showMobileSessions ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header */}
          <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-500" />
              <select className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer text-zinc-200">
                <option>default</option>
                <option>work-profile</option>
              </select>
            </div>
            <button className="md:hidden p-1" onClick={() => setShowMobileSessions(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2" 
               onDragOver={handleDragOver}
               onDrop={(e) => handleDrop(e, null, 'root', false)}>
            <SessionTree 
              groups={groups} 
              sessions={sessions} 
              expandedNodes={expandedNodes} 
              toggleExpand={toggleExpand}
              activePane={activePane}
              setActivePane={setActivePane}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-zinc-800">
             <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-zinc-500">
                <LogOut className="w-3 h-3" /> Logout
             </Button>
          </div>
        </aside>

        {/* MAIN CONTENT (TERMINAL) */}
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
          
          {/* Mobile Header */}
          <header className="h-12 border-b border-zinc-800 flex md:hidden items-center justify-between px-4 bg-zinc-900">
             <button onClick={() => setShowMobileSessions(true)}><Menu className="w-5 h-5" /></button>
             <span className="font-mono text-sm">hsk / 1:zsh / %2</span>
             <div className="w-5" /> {/* Spacer */}
          </header>

          {/* Tabs (Desktop Only) */}
          <div className="hidden md:flex h-9 bg-zinc-900 border-b border-zinc-800 items-end px-2 space-x-1">
            <div className="bg-zinc-800 text-zinc-200 px-3 py-1.5 text-xs border-t border-x border-zinc-700 rounded-t flex items-center gap-2">
              <span>hsk / 1:zsh / %2</span>
              <X className="w-3 h-3 hover:text-white cursor-pointer" />
            </div>
            <div className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">
              dify / 1:zsh / %1
            </div>
            <button className="p-1 hover:bg-zinc-800 rounded mb-1"><Plus className="w-3 h-3" /></button>
          </div>

          {/* Terminal Viewport */}
          <div className="flex-1 p-4 overflow-hidden font-mono text-sm relative">
             <div className="absolute inset-0 p-4 overflow-auto text-zinc-300 selection:bg-zinc-700">
                <div className="text-green-500">➜  ~  git status</div>
                <div>On branch feature/auth-implementation</div>
                <div className="text-red-400">Untracked files:</div>
                <div className="text-red-400">  (use "git add &lt;file&gt;..." to include in what will be committed)</div>
                <div className="pl-4 text-red-400">src/auth/login.ts</div>
                <br/>
                <div className="text-green-500">➜  ~  npm run dev</div>
                <div className="text-zinc-500">&gt; project-hsk@0.1.0 dev</div>
                <div className="text-zinc-500">&gt; next dev</div>
                <br/>
                <div>ready - started server on 0.0.0.0:3000, url: http://localhost:3000</div>
                <div>event - compiled client and server successfully in 1241 ms (156 modules)</div>
                <div>wait  - compiling...</div>
                <div>event - compiled client and server successfully in 341 ms (156 modules)</div>
                <div className="animate-pulse inline-block w-2 h-4 bg-zinc-500 align-middle ml-1"></div>
             </div>
             
             {/* Disconnect Overlay (Hidden by default) */}
             {/* <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-zinc-900 p-4 rounded border border-red-900 text-red-500">Session Disconnected</div>
             </div> */}
          </div>

        </main>

        {/* RIGHT DRAWER (Desktop: Static, Mobile: Sheet) */}
        <aside className={`
          fixed inset-y-0 right-0 w-80 lg:w-96 bg-zinc-900 border-l border-zinc-800 z-30 transition-transform duration-300 flex flex-col
          md:relative md:translate-y-0 md:h-auto
          ${showMobileDetails ? 'translate-y-[10vh] rounded-t-xl shadow-2xl' : 'translate-y-full md:translate-y-0'}
          h-[90vh] md:h-auto bottom-0 top-auto md:top-0
        `}>
           {/* Mobile Drag Handle */}
           <div 
             className="md:hidden h-6 bg-zinc-800 rounded-t-xl flex justify-center items-center cursor-pointer"
             onClick={() => setShowMobileDetails(false)}
            >
             <div className="w-12 h-1 bg-zinc-600 rounded-full" />
           </div>

           <PaneDetails activePane={activePane} onClose={() => setShowMobileDetails(false)} />
        </aside>
      
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden h-14 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around shrink-0 z-40">
        <button 
          onClick={() => { setShowMobileSessions(true); setShowMobileDetails(false); }}
          className="flex flex-col items-center gap-1 text-zinc-400 active:text-blue-500"
        >
          <List className="w-5 h-5" />
          <span className="text-[10px]">Sessions</span>
        </button>
        <button 
          onClick={() => { setShowMobileSessions(false); setShowMobileDetails(false); }}
          className="flex flex-col items-center gap-1 text-blue-500"
        >
          <Terminal className="w-5 h-5" />
          <span className="text-[10px]">Term</span>
        </button>
        <button 
          onClick={() => { setShowMobileDetails(true); setShowMobileSessions(false); }}
          className="flex flex-col items-center gap-1 text-zinc-400 active:text-blue-500"
        >
          <Layout className="w-5 h-5" />
          <span className="text-[10px]">Details</span>
        </button>
      </nav>

      {/* Mobile Backdrop */}
      {(showMobileSessions || showMobileDetails) && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-[1px]" 
          onClick={() => { setShowMobileSessions(false); setShowMobileDetails(false); }}
        />
      )}

    </div>
  );
}

/**
 * TREE COMPONENT
 * Recursively renders Groups -> Sessions -> Windows -> Panes
 */
const SessionTree = ({ groups, sessions, expandedNodes, toggleExpand, activePane, setActivePane, onDragStart, onDrop }) => {
  
  // Sort Logic: Ungrouped (sort_order asc) -> Groups (sort_order asc)
  const sortedItems = useMemo(() => {
    const ungrouped = sessions.filter(s => !s.groupId).map(s => ({ ...s, type: 'session' }));
    const groupNodes = groups.map(g => ({ ...g, type: 'group' }));
    
    // Simple sort by sortOrder (in real app would handle same-order collision logic)
    return [...ungrouped, ...groupNodes].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [groups, sessions]);

  return (
    <div className="space-y-0.5 select-none">
      {sortedItems.map(item => {
        if (item.type === 'group') {
          // Render Group
          const groupSessions = sessions.filter(s => s.groupId === item.id).sort((a, b) => a.sortOrder - b.sortOrder);
          const isExpanded = expandedNodes[item.id];

          return (
            <div 
              key={item.id} 
              className="space-y-0.5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, item.id, 'group', true)}
            >
              <div 
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800/50 rounded cursor-pointer group"
                onClick={() => toggleExpand(item.id)}
              >
                <GripVertical className="w-3 h-3 text-zinc-700 opacity-0 group-hover:opacity-100 cursor-grab" />
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {isExpanded ? <FolderOpen className="w-3 h-3 text-blue-500/80" /> : <Folder className="w-3 h-3 text-blue-500/80" />}
                <span>{item.title}</span>
                <span className="text-zinc-600 ml-auto text-[10px]">{groupSessions.length}</span>
              </div>
              
              {isExpanded && (
                <div className="ml-2 border-l border-zinc-800 pl-1 space-y-0.5">
                  {groupSessions.map(session => (
                    <SessionNode 
                      key={session.id} 
                      session={session} 
                      expandedNodes={expandedNodes} 
                      toggleExpand={toggleExpand}
                      activePane={activePane}
                      setActivePane={setActivePane}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        } else {
          // Render Ungrouped Session
          return (
            <SessionNode 
              key={item.id} 
              session={item} 
              expandedNodes={expandedNodes} 
              toggleExpand={toggleExpand}
              activePane={activePane}
              setActivePane={setActivePane}
              onDragStart={onDragStart}
            />
          );
        }
      })}
    </div>
  );
};

const SessionNode = ({ session, expandedNodes, toggleExpand, activePane, setActivePane, onDragStart }) => {
  const isExpanded = expandedNodes[session.id];
  
  return (
    <div 
      className="space-y-0.5"
      draggable
      onDragStart={(e) => onDragStart(e, session, 'session')}
    >
      <div 
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer group"
        onClick={() => toggleExpand(session.id)}
      >
        <GripVertical className="w-3 h-3 text-zinc-700 opacity-0 group-hover:opacity-100 cursor-grab" />
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Terminal className="w-3 h-3 text-zinc-500" />
        <span className="truncate font-medium">{session.title}</span>
      </div>

      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {session.windows.map(window => (
            <div key={window.id}>
              <div 
                className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded cursor-pointer pl-6"
                onClick={() => toggleExpand(window.id)}
              >
                {/* Windows act like folders for panes */}
                <span className="font-mono opacity-70">{window.name}</span>
              </div>
              
              {expandedNodes[window.id] && (
                 <div className="ml-4 border-l border-zinc-800">
                    {window.panes.map(pane => {
                      const isActive = activePane.paneId === pane.id;
                      return (
                        <div 
                          key={pane.id}
                          onClick={() => setActivePane({ sessionId: session.id, windowId: window.id, paneId: pane.id })}
                          className={`
                            flex items-center justify-between px-2 py-1.5 text-xs font-mono cursor-pointer border-l-2 pl-3
                            ${isActive 
                              ? 'bg-blue-900/20 text-blue-300 border-blue-500' 
                              : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-800/30'}
                          `}
                        >
                          <span>{pane.name}</span>
                          <div className={`w-2 h-2 rounded-full ${
                             pane.status === 'in-progress' ? 'bg-blue-500' : 
                             pane.status === 'done' ? 'bg-green-500' : 'bg-zinc-700'
                          }`} />
                        </div>
                      );
                    })}
                 </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * RIGHT DRAWER: PANE DETAILS
 */
const PaneDetails = ({ activePane, onClose }) => {
  const [paneStatus, setPaneStatus] = useState('in-progress');
  const [showSummaryPicker, setShowSummaryPicker] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState({ conv: true, cmd: false });

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-zinc-900">
        <div className="flex flex-col leading-none">
           <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Pane Details</span>
           <span className="text-sm font-mono text-zinc-200">hsk / 1:zsh / %2</span>
        </div>
        <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose}><X className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><Settings className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Status Section */}
        <section className="space-y-3">
           <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Current Status</label>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowSummaryPicker(true)}>
                 <Clock className="w-3 h-3 mr-1" /> Load History
              </Button>
           </div>
           <div className="flex bg-zinc-950 p-1 rounded-md border border-zinc-800">
              {['idle', 'in-progress', 'done'].map(status => (
                <button
                  key={status}
                  onClick={() => setPaneStatus(status)}
                  className={`
                    flex-1 py-1.5 text-xs font-medium rounded capitalize text-center transition-all
                    ${paneStatus === status ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}
                  `}
                >
                  {status}
                </button>
              ))}
           </div>
        </section>

        {/* Task Section */}
        <section className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex justify-between items-start">
             <div>
                <div className="text-[10px] text-zinc-500 mb-1">CURRENT TASK #123</div>
                <div className="font-medium text-zinc-200 text-sm">Auth Implementation</div>
                <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                   <Play className="w-3 h-3" /> Started 10:30 AM
                </div>
             </div>
             <Button variant="primary" size="sm" className="h-7 text-xs">Mark Done</Button>
          </div>
          <div className="pt-2 border-t border-zinc-800 flex gap-2">
             <Button variant="secondary" size="sm" className="w-full text-xs h-7">New Task</Button>
          </div>
        </section>

        {/* Logs Section */}
        <section className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 uppercase">Segment Logs</label>
          
          {/* Conversation Accordion */}
          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/30">
             <button 
               className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-900 text-xs font-medium text-zinc-300"
               onClick={() => setLogsExpanded(p => ({...p, conv: !p.conv}))}
             >
                <div className="flex items-center gap-2">
                   <MessageSquare className="w-3 h-3 text-blue-400" /> Conversation ({MOCK_LOGS.conversation.length})
                </div>
                {logsExpanded.conv ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
             </button>
             {logsExpanded.conv && (
               <div className="p-2 space-y-2 border-t border-zinc-800">
                  {MOCK_LOGS.conversation.map((msg, i) => (
                    <div key={i} className="text-xs">
                      <span className={`font-bold ${msg.role === 'user' ? 'text-purple-400' : 'text-blue-400'}`}>
                         {msg.role}: 
                      </span>
                      <span className="text-zinc-400 ml-1">{msg.text}</span>
                    </div>
                  ))}
               </div>
             )}
          </div>

          {/* Commands Accordion */}
          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/30">
             <button 
               className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-900 text-xs font-medium text-zinc-300"
               onClick={() => setLogsExpanded(p => ({...p, cmd: !p.cmd}))}
             >
                <div className="flex items-center gap-2">
                   <Code className="w-3 h-3 text-green-400" /> Commands ({MOCK_LOGS.commands.length})
                </div>
                {logsExpanded.cmd ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
             </button>
             {logsExpanded.cmd && (
               <div className="p-2 space-y-2 border-t border-zinc-800 font-mono">
                  {MOCK_LOGS.commands.map((c, i) => (
                    <div key={i} className="text-xs text-zinc-400 truncate border-l-2 border-zinc-700 pl-2">
                       $ {c.cmd}
                    </div>
                  ))}
               </div>
             )}
          </div>
        </section>

        {/* Summaries Section */}
        <section className="space-y-2">
           <label className="text-xs font-semibold text-zinc-500 uppercase flex items-center justify-between">
              Summaries
              <span className="text-[10px] bg-green-900/30 text-green-500 px-1 rounded">Live</span>
           </label>
           
           <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-3 space-y-3">
              <div>
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                       <Terminal className="w-3 h-3" /> Command Summary
                    </span>
                    <button className="text-zinc-500 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                 </div>
                 <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800/50">
                    Setup JWT auth with cookie-based session storage.
                 </p>
              </div>
              
              <div>
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                       <FileText className="w-3 h-3" /> Output Summary
                    </span>
                    <button className="text-zinc-500 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                 </div>
                 <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800/50">
                    Successfully implemented login endpoint. Server restarted.
                 </p>
              </div>
           </div>
        </section>

        {/* History (Collapsed List) */}
        <section>
           <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Previous Tasks</h3>
           <div className="space-y-1">
              {MOCK_HISTORY.map(task => (
                 <div key={task.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded text-xs text-zinc-400 cursor-pointer">
                    <CheckCircle className="w-3 h-3 text-green-700" />
                    <span className="line-through opacity-60">#{task.id} {task.title}</span>
                    <span className="ml-auto text-[10px] opacity-40">{task.date}</span>
                 </div>
              ))}
           </div>
        </section>

      </div>

      {/* MODAL: Summary Picker */}
      {showSummaryPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                 <h3 className="font-bold text-sm">Load Previous Summary</h3>
                 <button onClick={() => setShowSummaryPicker(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 bg-zinc-950 max-h-64 overflow-y-auto">
                 <p className="text-xs text-zinc-500 mb-3">Found 2 candidates for "hsk"</p>
                 <div className="space-y-2">
                    {[1, 2].map(i => (
                       <label key={i} className="flex items-start gap-3 p-3 border border-zinc-800 rounded hover:bg-zinc-900 cursor-pointer transition-colors group">
                          <input type="radio" name="summary_cand" className="mt-1 bg-zinc-800 border-zinc-700" />
                          <div>
                             <div className="text-xs font-bold text-zinc-300 mb-1">2026-02-08 18:{20 + i}</div>
                             <div className="text-[10px] text-zinc-500 mb-2 font-mono">window 1 / pane 2</div>
                             <div className="text-xs text-zinc-400 italic">"Implemented cookie auth..."</div>
                          </div>
                       </label>
                    ))}
                 </div>
              </div>
              <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex justify-end gap-2">
                 <Button variant="secondary" onClick={() => setShowSummaryPicker(false)}>Cancel</Button>
                 <Button variant="primary" onClick={() => setShowSummaryPicker(false)}>Load</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
