import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Terminal, Settings, ChevronRight, ChevronDown, Plus,
  X, Menu, FolderOpen, Hash, Monitor, RefreshCw,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import TerminalPane from './components/TerminalPane';
import VoiceInput from './components/VoiceInput';
import BottomToolbox from './components/BottomToolbox';
import useShakeDetect from './hooks/useShakeDetect';
import rlog from './utils/rlog';

/**
 * THEME CONFIGURATION
 */
const THEME = {
  bg: 'bg-[#0f1115]',
  sidebar: 'bg-[#181a1f]',
  sidebarHeader: 'bg-[#21252b] border-b border-[#181a1f]',
  border: 'border-[#2b2d31]',
  text: 'text-[#9da5b4]',
  textActive: 'text-white',
  accent: 'text-[#4d78cc]',
  tabActive: 'bg-[#282c34] text-white border-t-2 border-[#4d78cc] shadow-sm',
  tabInactive: 'bg-[#21252b] text-[#6b717d]',
};

/**
 * HELPER COMPONENTS
 */
const IconButton = ({ icon: Icon, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-md transition-all active:scale-95 touch-manipulation text-[#9da5b4] hover:bg-white/5 ${className}`}
  >
    <Icon className="w-5 h-5" />
  </button>
);

const TabItem = ({ active, title, onClick, onClose }) => (
  <div
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer select-none 
      min-w-[120px] max-w-[180px] border-r border-[#181a1f] transition-colors shrink-0
      ${active ? THEME.tabActive : THEME.tabInactive}
    `}
  >
    <span className="truncate flex-1">{title}</span>
    <X
      className="w-3.5 h-3.5 opacity-60 hover:opacity-100 hover:text-white p-0.5 rounded-full hover:bg-white/10"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    />
  </div>
);

/**
 * MAIN APP
 */
export default function App() {
  // Session data from tmux backend
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Responsive: detect mobile vs desktop
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // UI state — restore tabs from localStorage
  const [expandedNodes, setExpandedNodes] = useState({});
  const [openTabs, setOpenTabs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('openTabs') || '[]'); } catch { return []; }
  });
  const [activeTabId, setActiveTabId] = useState(() => localStorage.getItem('activeTabId') || null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Persist tabs to localStorage
  useEffect(() => {
    localStorage.setItem('openTabs', JSON.stringify(openTabs));
    localStorage.setItem('activeTabId', activeTabId || '');
  }, [openTabs, activeTabId]);

  // Refs for terminal write callbacks (keyed by tab id)
  const terminalSendRefs = useRef({});
  const voiceRef = useRef(null);
  const [shakeToast, setShakeToast] = useState('');

  // Shake to activate microphone (iOS)
  useShakeDetect(() => {
    if (voiceRef.current) {
      voiceRef.current.toggle();
      // Brief toast feedback
      const msg = voiceRef.current.status === 'idle' ? '🎤 摇一摇 · 语音输入' : '🛑 停止录音';
      setShakeToast(msg);
      setTimeout(() => setShakeToast(''), 1500);
    }
  }, { threshold: 15, shakeCount: 3, enabled: true });

  // Send text to the active terminal pane
  const sendToActiveTerminal = useCallback((text) => {
    if (activeTabId && terminalSendRefs.current[activeTabId]) {
      terminalSendRefs.current[activeTabId](text);
    }
  }, [activeTabId]);

  // Fetch sessions from backend
  const fetchSessions = useCallback(async () => {
    try {
      rlog.info('Fetching sessions');
      const res = await fetch('/api/sessions');
      const data = await res.json();
      rlog.info('Sessions loaded', { count: (data.sessions || []).length });
      setSessions(data.sessions || []);

      // Auto-expand all sessions on first load
      if (Object.keys(expandedNodes).length === 0) {
        const expanded = {};
        (data.sessions || []).forEach(s => { expanded[s.id] = true; });
        setExpandedNodes(expanded);
      }
    } catch (err) {
      rlog.error('Failed to fetch sessions', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const toggleExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Open a pane in a new tab (or switch to existing)
  const openPane = (pane, sessionTitle, windowName) => {
    const tabTitle = `${sessionTitle}:${windowName}`;
    rlog.info('Opening pane', { target: pane.target, tabTitle });
    const existing = openTabs.find(t => t.paneTarget === pane.target);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const newTab = {
        id: `tab-${Date.now()}`,
        title: tabTitle,
        paneTarget: pane.target
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
    // Close sidebar on mobile after selecting
    if (isMobile) setSidebarOpen(false);
  };

  const closeTab = (tabId) => {
    setOpenTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
      }
      return filtered;
    });
  };

  const activeTab = openTabs.find(t => t.id === activeTabId);

  // ── Sidebar content (shared by mobile drawer & desktop fixed) ──
  const sidebarContent = (
    <>
      {/* Header */}
      <div className={`h-14 flex items-center justify-between px-4 shrink-0 ${THEME.sidebarHeader}`}>
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[#4d78cc]" />
          <span className="text-sm font-bold tracking-wider text-white">SESSIONS</span>
        </div>
        <div className="flex gap-1">
          <IconButton icon={RefreshCw} onClick={fetchSessions} />
          {isMobile && <IconButton icon={ChevronRight} onClick={() => setSidebarOpen(false)} />}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[#6b717d] text-sm">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#6b717d] text-sm gap-2">
            <Terminal className="w-6 h-6 opacity-50" />
            No tmux sessions found
          </div>
        ) : (
          <SessionTree
            sessions={sessions}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            openPane={openPane}
            activeTarget={activeTab?.paneTarget}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#2b2d31] bg-[#1b1d23]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
            T
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-white font-medium">tmux@localhost</span>
            <span className="text-[10px] text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected
            </span>
          </div>
        </div>
      </div>
    </>
  );

  // ── Terminal viewport (shared) ──
  const terminalViewport = (
    <>
      {activeTab ? (
        openTabs.map(tab => (
          <div key={tab.id} className={`absolute inset-0 ${tab.id === activeTabId ? '' : 'hidden'}`}>
            <TerminalPane
              paneTarget={tab.paneTarget}
              active={tab.id === activeTabId}
              onSendRef={(sendFn) => { terminalSendRefs.current[tab.id] = sendFn; }}
            />
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[#6b717d] gap-4">
          <Terminal className="w-12 h-12 opacity-30" />
          <p className="text-sm">Open a session from the sidebar</p>
          <button
            onClick={() => isMobile ? setSidebarOpen(true) : null}
            className="px-4 py-2 bg-[#4d78cc] text-white text-sm rounded-lg hover:bg-[#5a8ae0] transition-colors"
          >
            Browse Sessions
          </button>
        </div>
      )}
    </>
  );

  // ── Tab bar (shared) ──
  const tabBar = (
    <header className="h-12 flex bg-[#21252b] border-b border-black items-center relative z-30 shadow-md shrink-0">
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="h-full px-4 border-r border-black hover:bg-[#2c313a] active:bg-[#4d78cc] active:text-white text-[#9da5b4] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <div className="flex-1 flex overflow-x-auto no-scrollbar">
        {openTabs.map(tab => (
          <TabItem
            key={tab.id}
            title={tab.title}
            active={tab.id === activeTabId}
            onClick={() => setActiveTabId(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
      </div>

      <div className="flex items-center px-3 border-l border-black bg-[#21252b]">
        <Plus className="w-5 h-5 text-[#6b717d] cursor-pointer hover:text-white" onClick={() => setSidebarOpen(true)} />
      </div>
    </header>
  );

  // ════════════════════════════════════════════════
  // DESKTOP LAYOUT (≥768px): sidebar fixed left + full terminal
  // ════════════════════════════════════════════════
  if (!isMobile) {
    return (
      <div className={`h-screen w-screen flex font-sans ${THEME.bg} text-[#abb2bf] overflow-hidden`}>
        {/* Fixed sidebar — hidden in fullscreen */}
        {!fullscreen && (
          <aside className={`w-72 flex flex-col shrink-0 ${THEME.sidebar} border-r ${THEME.border}`}>
            {sidebarContent}
          </aside>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar with fullscreen toggle */}
          <header className={`flex items-center h-10 ${THEME.sidebar} border-b ${THEME.border} select-none shrink-0`}>
            {/* Sidebar toggle (only in fullscreen) */}
            {fullscreen && (
              <button
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1 px-3 h-full text-[#6b717d] hover:text-white hover:bg-white/5 transition-colors"
                title="退出全屏"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Tabs */}
            <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
              {openTabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  active={tab.id === activeTabId}
                  title={tab.title}
                  onClick={() => setActiveTabId(tab.id)}
                  onClose={() => closeTab(tab.id)}
                />
              ))}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setFullscreen(f => !f)}
              className="flex items-center gap-1 px-3 h-full text-[#6b717d] hover:text-white hover:bg-white/5 transition-colors border-l border-[#2b2d31]"
              title={fullscreen ? '退出全屏' : '全屏模式'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {!fullscreen && (
              <div className="flex items-center px-3 border-l border-black bg-[#21252b]">
                <Plus className="w-5 h-5 text-[#6b717d] cursor-pointer hover:text-white" onClick={() => setSidebarOpen(true)} />
              </div>
            )}
          </header>

          {/* Shake toast */}
          {shakeToast && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/80 backdrop-blur-md text-white text-sm rounded-full shadow-lg animate-bounce">
              {shakeToast}
            </div>
          )}

          {/* Terminal + Toolbox side by side */}
          <div className="flex-1 flex overflow-hidden">
            {/* Terminal — fills remaining space */}
            <main className="flex-1 relative overflow-hidden">
              {terminalViewport}
            </main>

            {/* Toolbox — right panel, hidden in fullscreen */}
            {!fullscreen && (
              <div className={`w-80 flex flex-col shrink-0 border-l ${THEME.border}`}>
                <BottomToolbox
                  onSend={sendToActiveTerminal}
                  disabled={!activeTabId}
                  voiceRef={voiceRef}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // MOBILE LAYOUT (<768px): drawer sidebar + 50/50 split
  // ════════════════════════════════════════════════
  return (
    <div className={`h-screen w-screen flex flex-col font-sans ${THEME.bg} text-[#abb2bf] overflow-hidden`}>

      {/* BACKDROP OVERLAY */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out
          ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setSidebarOpen(false)}
      />

      {/* SIDEBAR DRAWER */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[85vw] flex flex-col shadow-2xl ${THEME.sidebar} ${THEME.border} border-r
        transform transition-transform duration-300 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent}
      </aside>

      {/* MAIN CONTENT — top half (terminal) */}
      <div className="flex flex-col min-w-0 relative" style={{ height: '50%' }}>
        {tabBar}

        {/* Shake toast notification */}
        {shakeToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/80 backdrop-blur-md text-white text-sm rounded-full shadow-lg animate-bounce">
            {shakeToast}
          </div>
        )}

        {/* TERMINAL VIEWPORT */}
        <main className="flex-1 relative overflow-hidden">
          {terminalViewport}
        </main>
      </div>

      {/* BOTTOM TOOLBOX — bottom half */}
      <BottomToolbox
        onSend={sendToActiveTerminal}
        disabled={!activeTabId}
        voiceRef={voiceRef}
      />
    </div>
  );
}

/**
 * SESSION TREE
 */
const SessionTree = ({ sessions, expandedNodes, toggleExpand, openPane, activeTarget }) => (
  <div className="flex flex-col gap-0.5 pb-10">
    {sessions.map(session => (
      <SessionNode
        key={session.id}
        session={session}
        expandedNodes={expandedNodes}
        toggleExpand={toggleExpand}
        openPane={openPane}
        activeTarget={activeTarget}
      />
    ))}
  </div>
);

const SessionNode = ({ session, expandedNodes, toggleExpand, openPane, activeTarget }) => {
  const isExpanded = expandedNodes[session.id];
  const hasWindows = session.windows && session.windows.length > 0;

  return (
    <div className="relative">
      <div
        className="flex items-center px-4 py-3 cursor-pointer hover:bg-[#2c313a] active:bg-[#3e4451] transition-colors"
        onClick={() => toggleExpand(session.id)}
      >
        <div className="w-5 flex justify-center mr-1">
          {hasWindows ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-[#9da5b4]" /> : <ChevronRight className="w-4 h-4 text-[#9da5b4]" />
          ) : <div className="w-4 h-4" />}
        </div>
        <Hash className="w-4 h-4 text-[#4d78cc] mr-3" />
        <span className="flex-1 font-medium text-sm text-gray-300">{session.name}</span>
        {hasWindows && (
          <span className="text-[10px] bg-[#3e4451] text-white px-2 py-0.5 rounded-full font-bold">
            {session.windows.length}
          </span>
        )}
      </div>

      {isExpanded && hasWindows && (
        <div className="flex flex-col ml-5 border-l border-[#3e4451] pl-1">
          {session.windows.map(window => (
            <WindowNode
              key={window.id}
              window={window}
              sessionName={session.name}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              openPane={openPane}
              activeTarget={activeTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const WindowNode = ({ window: win, sessionName, expandedNodes, toggleExpand, openPane, activeTarget }) => {
  const isExpanded = expandedNodes[win.id];
  const hasPanes = win.panes && win.panes.length > 0;

  return (
    <div className="relative">
      <div
        className="flex items-center px-3 py-2 cursor-pointer hover:bg-[#2c313a] rounded-md"
        onClick={() => {
          if (hasPanes) toggleExpand(win.id);
        }}
      >
        <span className="text-gray-500 text-[10px] font-mono mr-2 w-4 text-right">{win.index}</span>
        <Monitor className="w-3.5 h-3.5 text-gray-500 mr-2 opacity-70" />
        <span className="text-[13px] text-[#9da5b4]">{win.name}</span>
        {hasPanes && (
          <span className="ml-auto text-[10px] text-gray-600">{win.panes.length}p</span>
        )}
      </div>

      {isExpanded && hasPanes && (
        <div className="flex flex-col mb-1">
          {win.panes.map(pane => (
            <div
              key={pane.id}
              onClick={() => openPane(pane, sessionName, win.name)}
              className={`
                flex items-center px-3 py-2.5 cursor-pointer pl-8 rounded-md mx-1 mb-0.5 transition-all
                ${activeTarget === pane.target
                  ? 'bg-[#4d78cc] text-white shadow-md'
                  : 'hover:bg-[#2c313a] text-gray-500'
                }
              `}
            >
              <span className="text-[10px] font-mono mr-2 opacity-80">%{pane.index}</span>
              <span className="text-[13px] font-medium">{pane.title || pane.command}</span>
              {activeTarget === pane.target && (
                <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-sm" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
