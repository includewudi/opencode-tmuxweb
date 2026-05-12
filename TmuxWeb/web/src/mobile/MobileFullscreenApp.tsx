import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Menu, Mic, ArrowLeft, Maximize2, X } from 'lucide-react'
import { TerminalSquare, ScrollText, FolderSearch, FolderTree, GitBranch, BrainCircuit, History, BarChart3, Settings, LogOut, Languages } from 'lucide-react'
import { MobileDrawer } from './MobileDrawer'
import { getToken } from '../utils/auth'
import { checkAuth, logout } from '../utils/auth'
import { LoginModal } from '../shared/components/LoginModal'
import { VoiceInput, VoiceInputHandle } from '../shared/components/VoiceInput'
import useVisualViewport from '../hooks/useVisualViewport'
import useShakeDetect from '../hooks/useShakeDetect'
import { TmuxSession, OpenTab, Profile, SessionGroup } from '../types'
import { MobileImperialStudy } from './MobileImperialStudy'
import { MobileFileBrowser } from './MobileFileBrowser'
import { MobileQuickOpen } from './MobileQuickOpen'
import { MobileGitPanel } from './MobileGitPanel'
import { MobileEphemeralTerminal } from './MobileEphemeralTerminal'
import { MobileCLIHistory } from './MobileCLIHistory'
import { MobileSessionBrowser } from './MobileSessionBrowser'
import { MobileProjectOverview } from './MobileProjectOverview'
import { GroupManager } from '../shared/components/GroupManager'
import { TranslationPanel } from '../shared/components/translation/TranslationPanel'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'
import 'xterm/css/xterm.css'
import './mobile.css'
import './MobileFullscreenApp.css'

const CLIENT_ID = Math.random().toString(36).slice(2)
const THEME = {
  background: '#0f1115', foreground: '#abb2bf', cursor: '#4d78cc',
  selectionBackground: 'rgba(77,120,204,.3)',
  black: '#1e2127', red: '#e06c75', green: '#98c379',
  yellow: '#d19a66', blue: '#61afef', magenta: '#c678dd',
  cyan: '#56b6c2', white: '#abb2bf',
}

function loadTabs(): OpenTab[] { try { return JSON.parse(localStorage.getItem('fs-tabs') || '[]') } catch { return [] } }
function saveTabs(t: OpenTab[]) { localStorage.setItem('fs-tabs', JSON.stringify(t)) }
function loadActiveId(): string | null { return localStorage.getItem('fs-activeTab') || null }
function saveActiveId(id: string | null) { id ? localStorage.setItem('fs-activeTab', id) : localStorage.removeItem('fs-activeTab') }

function getAllPaneIds(sessions: TmuxSession[]): Set<string> {
  const ids = new Set<string>()
  for (const s of sessions) for (const w of s.windows) for (const p of w.panes) ids.add(p.paneId)
  return ids
}

export default function MobileFullscreenApp() {
  const [auth, setAuth] = useState<boolean | null>(null)
  const [tabs, setTabs] = useState<OpenTab[]>(loadTabs)
  const [activeTabId, setActiveTabId] = useState<string | null>(loadActiveId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [fontSize] = useState(() => { const s = localStorage.getItem('terminal-font-size'); return s ? parseFloat(s) : 10 })

  const [menuOpen, setMenuOpen] = useState(false)

  // Floating panels
  const [imperialOpen, setImperialOpen] = useState(false)
  const [yaziOpen, setYaziOpen] = useState(false)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [cliHistoryOpen, setCLIHistoryOpen] = useState(false)
  const [sessionBrowserOpen, setSessionBrowserOpen] = useState(false)
  const [projectOverviewOpen, setProjectOverviewOpen] = useState(false)
  const [translateOpen, setTranslateOpen] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const termMapRef = useRef<Map<string, { term: XTerm; fit: FitAddon; ws: WebSocket | null }>>(new Map())
  const voiceRef = useRef<VoiceInputHandle>(null)

  useEffect(() => { saveTabs(tabs) }, [tabs])
  useEffect(() => { saveActiveId(activeTabId) }, [activeTabId])
  useEffect(() => { checkAuth().then(ok => setAuth(ok)) }, [])
  useVisualViewport()
  useShakeDetect(() => { voiceRef.current?.toggle() }, { enabled: tabs.length > 0 })

  // URL paneId on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlPaneId = params.get('paneId')
    if (urlPaneId) {
      const existing = tabs.find(t => t.paneId === urlPaneId)
      if (existing) setActiveTabId(existing.id)
      else { const nt: OpenTab = { id: `tab-${urlPaneId}`, paneId: urlPaneId, title: urlPaneId }; setTabs([nt]); setActiveTabId(nt.id) }
      window.history.replaceState({}, '', '/fullscreen')
    }
  }, [])

  const fetchTree = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tmux/tree', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newSessions: TmuxSession[] = data.sessions || []
      setSessions(newSessions); setError(null)
      const allIds = getAllPaneIds(newSessions)
      setTabs(prev => {
        const valid = prev.filter(t => allIds.has(t.paneId))
        if (valid.length !== prev.length) {
          setActiveTabId(a => a && valid.some(t => t.id === a) ? a : valid[0]?.id ?? null)
        }
        return valid
      })
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [])

  const fetchGroups = useCallback(async (key: string) => {
    try {
      const res = await fetch(`/api/groups?profile_key=${encodeURIComponent(key)}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      setGroups((await res.json()).groups || [])
    } catch { setGroups([]) }
  }, [])

  useEffect(() => { if (auth) fetchTree() }, [auth, fetchTree])

  const handleSelectPane = useCallback((id: string, name: string) => {
    setTabs(prev => {
      const ex = prev.find(t => t.paneId === id)
      if (ex) { setActiveTabId(ex.id); return prev }
      const nt: OpenTab = { id: `tab-${id}`, paneId: id, title: name }; setActiveTabId(nt.id); return [...prev, nt]
    })
    setDrawerOpen(false)
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId)
      const next = prev.filter(t => t.id !== tabId)
      const inst = termMapRef.current.get(tabId)
      if (inst) { inst.ws?.close(); inst.term.dispose(); termMapRef.current.delete(tabId) }
      setActiveTabId(a => a !== tabId ? a : next.length > 0 ? next[Math.min(idx, next.length - 1)].id : null)
      return next
    })
  }, [])

  const handleLogout = useCallback(async () => {
    await logout(); setAuth(false); setSessions([]); setTabs([]); setActiveTabId(null); setCurrentProfile(null); setGroups([])
    termMapRef.current.forEach(inst => { inst.ws?.close(); inst.term.dispose() })
    termMapRef.current.clear()
  }, [])

  const activePaneCwd = useMemo(() => {
    if (!activeTabId || !sessions.length) return null
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return null
    for (const s of sessions) {
      for (const w of s.windows) {
        const pane = w.panes.find(p => p.paneId === tab.paneId)
        if (pane?.currentPath) return pane.currentPath
      }
    }
    return null
  }, [activeTabId, sessions, tabs])

  // ── Terminal per-tab lifecycle ──
  const activePaneId = tabs.find(t => t.id === activeTabId)?.paneId ?? null

  useEffect(() => {
    if (!containerRef.current || !activePaneId || auth === null) return
    const map = termMapRef.current

    // Cleanup stale terminals not in current tabs
    const validIds = new Set(tabs.map(t => t.paneId))
    for (const [tid, inst] of map) {
      if (!validIds.has(inst.term.element?.dataset?.paneId || '')) {
        inst.ws?.close(); inst.term.dispose(); map.delete(tid)
      }
    }

    // Create or reuse terminal for this paneId
    let entry = Array.from(map.values()).find(e => {
      const el = e.term.element
      return el && el.dataset?.paneId === activePaneId && el.parentElement === containerRef.current
    })

    if (!entry) {
      const term = new XTerm({
        cursorBlink: true, fontSize,
        fontFamily: 'Menlo, Monaco, monospace',
        theme: THEME, scrollback: 5000,
        lineHeight: 1.2, drawBoldTextInBrightColors: true, cursorStyle: 'bar',
      })
      term.options.allowProposedApi = true
      const fit = new FitAddon()
      term.loadAddon(fit)

      // Clear container and mount
      containerRef.current.innerHTML = ''
      term.open(containerRef.current)
      ;(term.element as HTMLElement).dataset.paneId = activePaneId

      fit.fit(); setTimeout(() => fit.fit(), 100); setTimeout(() => fit.fit(), 300)

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const token = getToken()
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(activePaneId)}&token=${token}&clientId=${CLIENT_ID}`
      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })) }
      ws.onmessage = (e) => { term.write(e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data) }
      ws.onerror = () => term.write('\r\n\x1b[33m[Connection error]\x1b[0m\r\n')

      let attempt = 0
      ws.onclose = () => {
        attempt++
        if (attempt <= 3) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000)
          term.write(`\r\n\x1b[33m[断线，${Math.round(delay/1000)}s 重连...]\x1b[0m`)
          setTimeout(() => {
            if (map.get(activePaneId)?.ws !== ws) return
            const w = new WebSocket(wsUrl); w.binaryType = 'arraybuffer'
            w.onopen = ws.onopen; w.onmessage = ws.onmessage; w.onerror = ws.onerror; w.onclose = ws.onclose
            entry!.ws = w
          }, delay)
        } else { term.write('\r\n\x1b[31m[重连失败，刷新页面]\x1b[0m\r\n') }
      }

      term.onData((data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data) })

      const ro = new ResizeObserver(() => {
        fit.fit()
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      })
      ro.observe(containerRef.current)

      const onVis = () => {
        if (document.visibilityState === 'visible' && ws.readyState !== WebSocket.OPEN) {
          term.write('\r\n\x1b[36m[Resuming...]\x1b[0m\r\n'); attempt = 0
          const w = new WebSocket(wsUrl); w.binaryType = 'arraybuffer'
          w.onopen = ws.onopen; w.onmessage = ws.onmessage; w.onerror = ws.onerror; w.onclose = ws.onclose
          entry!.ws = w
        }
      }
      document.addEventListener('visibilitychange', onVis)

      entry = { term, fit, ws }
      map.set(`term-${Date.now()}-${activePaneId}`, entry)
    }

    return () => {}
  }, [activePaneId, auth, fontSize, tabs])

  const handleFit = useCallback(() => {
    if (!containerRef.current) return
    const el = containerRef.current.querySelector('.xterm') as HTMLElement | null
    if (!el) return
    const entry = Array.from(termMapRef.current.values()).find(e => e.term.element === el)
    if (entry?.ws?.readyState === WebSocket.OPEN) {
      entry.fit.fit()
      entry.ws.send(JSON.stringify({ type: 'fit-window', cols: entry.term.cols, rows: entry.term.rows }))
    }
  }, [])

  const sendToActiveTerminal = useCallback((text: string) => {
    for (const inst of termMapRef.current.values()) {
      if (inst.ws?.readyState === WebSocket.OPEN && inst.term.element?.dataset?.paneId === tabs.find(t => t.id === activeTabId)?.paneId) {
        inst.ws.send(text)
        return
      }
    }
  }, [activeTabId, tabs])

  if (auth === null) return <div className="mobile-loading">Loading...</div>
  if (!auth) return <LoginModal onLogin={() => setAuth(true)} />
  if (loading && sessions.length === 0) return <div className="mobile-loading">Loading...</div>
  if (error) return <div className="mobile-error">{error}</div>

  return (
    <div className="fs-app">
      <header className="fs-header">
        <button className="mobile-menu-btn" onClick={() => { setDrawerOpen(true); setMenuOpen(false) }} type="button"><Menu size={24} /></button>
        {tabs.length > 0 ? (
          <div className="mobile-tabs-bar">
            {tabs.map(tab => (
              <div key={tab.id} className={`mobile-tab ${tab.id === activeTabId ? 'active' : ''}`} onClick={() => setActiveTabId(tab.id)}>
                <span className="mobile-tab-title">{tab.title}</span>
                <button className="mobile-tab-close" onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id) }} type="button"><X size={12} /></button>
              </div>
            ))}
          </div>
        ) : (
          <span className="fs-title">Select a pane</span>
        )}
        <button className="mobile-menu-btn" onClick={() => window.location.href = '/m'} type="button" title="Back"><ArrowLeft size={22} /></button>
      </header>

      {drawerOpen && <div className="mobile-overlay" onClick={() => setDrawerOpen(false)} />}

      <MobileDrawer
        open={drawerOpen}
        sessions={sessions}
        currentProfile={currentProfile}
        groups={groups}
        statusRefreshToken={0}
        onProfileChange={(p) => { setCurrentProfile(p); fetchTree(); fetchGroups(p.profile_key) }}
        onGroupsChanged={() => { fetchTree(); if (currentProfile) fetchGroups(currentProfile.profile_key) }}
        onSelectPane={handleSelectPane}
        onClose={() => setDrawerOpen(false)}
        onRefresh={fetchTree}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {tabs.length > 0 ? (
          <div ref={containerRef} className="fs-terminal" />
        ) : (
          <div className="mobile-placeholder">
            <p>Tap <Menu size={20} /> to select a terminal</p>
          </div>
        )}
      </main>

      <div className="fs-bar">
        <VoiceInput ref={voiceRef} onText={(text) => {
          const paneId = tabs.find(t => t.id === activeTabId)?.paneId
          if (!paneId) return
          for (const inst of termMapRef.current.values()) {
            if (inst.ws?.readyState === WebSocket.OPEN && inst.term.element?.dataset?.paneId === paneId) {
              inst.ws.send(text)
              break
            }
          }
        }} />
        <button className="fs-btn" onClick={handleFit} type="button" title="Fit"><Maximize2 size={22} /></button>
        <button className="fs-btn" onClick={() => { setMenuOpen(true); setDrawerOpen(false) }} type="button" title="More"><TerminalSquare size={22} /></button>
      </div>

      {/* Bottom Sheet Menu */}
      {menuOpen && (
        <>
          <div className="fs-overlay" onClick={() => setMenuOpen(false)} />
          <div className="fs-sheet">
            <div className="fs-sheet-handle" />
            {/* Core features */}
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setDrawerOpen(true), 0) }}>
              <TerminalSquare size={20} /><span>会话管理</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setImperialOpen(v => !v), 0) }}>
              <ScrollText size={20} /><span>御书房</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setYaziOpen(v => !v), 0) }}>
              <FolderSearch size={20} /><span>文件管理器</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setGitOpen(v => !v), 0) }}>
              <GitBranch size={20} /><span>Git 操作</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setCLIHistoryOpen(v => !v), 0) }}>
              <BrainCircuit size={20} /><span>CLI 历史</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setTranslateOpen(v => !v), 0) }}>
              <Languages size={20} /><span>终端翻译</span>
            </button>
            {/* Divider */}
            <div className="fs-sheet-divider" />
            {/* Tools */}
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setQuickOpenOpen(v => !v), 0) }}>
              <FolderTree size={20} /><span>快速路径</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setSessionBrowserOpen(v => !v), 0) }}>
              <History size={20} /><span>Session 目录</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setProjectOverviewOpen(v => !v), 0) }}>
              <BarChart3 size={20} /><span>项目总览</span>
            </button>
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setTerminalOpen(v => !v), 0) }}>
              <TerminalSquare size={20} /><span>临时终端</span>
            </button>
            {/* Divider */}
            <div className="fs-sheet-divider" />
            {/* Settings */}
            <button className="fs-sheet-item" onClick={() => { setMenuOpen(false); setTimeout(() => setShowGroupManager(v => !v), 0) }}>
              <Settings size={20} /><span>分组管理</span>
            </button>
            <button className="fs-sheet-item fs-sheet-danger" onClick={() => { setMenuOpen(false); setTimeout(handleLogout, 0) }}>
              <LogOut size={20} /><span>退出登录</span>
            </button>
          </div>
        </>
      )}

      {/* Imperial Study */}
      <ErrorBoundary>
        <MobileImperialStudy open={imperialOpen} onClose={() => setImperialOpen(false)} activePaneKey={tabs.find(t => t.id === activeTabId)?.title ?? ''} />
      </ErrorBoundary>

      {/* File Browser */}
      <ErrorBoundary>
        <MobileFileBrowser open={yaziOpen} onClose={() => setYaziOpen(false)} dir={activePaneCwd || undefined} onSendPath={sendToActiveTerminal} />
      </ErrorBoundary>

      {/* Quick Open */}
      <ErrorBoundary>
        <MobileQuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} dir={activePaneCwd || undefined} onSendPath={sendToActiveTerminal} />
      </ErrorBoundary>

      {/* Git */}
      <ErrorBoundary>
        <MobileGitPanel open={gitOpen} onClose={() => setGitOpen(false)} dir={activePaneCwd || undefined} />
      </ErrorBoundary>

      {/* CLI History */}
      <ErrorBoundary>
        <MobileCLIHistory open={cliHistoryOpen} onClose={() => setCLIHistoryOpen(false)} cwd={activePaneCwd || undefined} />
      </ErrorBoundary>

      {/* Session Browser */}
      <ErrorBoundary>
        <MobileSessionBrowser open={sessionBrowserOpen} onClose={() => setSessionBrowserOpen(false)} cwd={activePaneCwd || undefined} onSendToTerminal={sendToActiveTerminal} />
      </ErrorBoundary>

      {/* Project Overview */}
      <ErrorBoundary>
        <MobileProjectOverview open={projectOverviewOpen} onClose={() => setProjectOverviewOpen(false)} />
      </ErrorBoundary>

      {/* Ephemeral Terminal */}
      <ErrorBoundary>
        <MobileEphemeralTerminal open={terminalOpen} onClose={() => setTerminalOpen(false)} cwd={activePaneCwd || undefined} />
      </ErrorBoundary>

      {/* Translation */}
      {translateOpen && (
        <div className="mobile-overlay" onClick={() => setTranslateOpen(false)}>
          <div className="mobile-imperial-panel mobile-translate-panel">
            <header className="mobile-imperial-header">
              <span>终端翻译</span>
              <button className="mobile-menu-btn" onClick={() => setTranslateOpen(false)} type="button"><X size={18} /></button>
            </header>
            <TranslationPanel paneId={tabs.find(t => t.id === activeTabId)?.paneId ?? null} />
          </div>
        </div>
      )}

      {/* Group Manager Modal */}
      {showGroupManager && (
        <div className="mobile-overlay" onClick={() => setShowGroupManager(false)}>
          <div className="mobile-imperial-panel" style={{ zIndex: 200 }}>
            <header className="mobile-imperial-header">
              <span>分组管理</span>
              <button className="mobile-menu-btn" onClick={() => setShowGroupManager(false)} type="button"><X size={18} /></button>
            </header>
            {currentProfile ? (
              <GroupManager profileKey={currentProfile.profile_key} sessions={sessions} onGroupsChanged={fetchTree} />
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Please select a Profile first</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
