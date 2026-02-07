import "./global.css";
import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Server, TmuxSession, TmuxWindow, Screen } from './src/types';
import { ServerListScreen, ServerDetailScreen, ServerEditScreen, TerminalScreen } from './src/screens';
import { AIAssistantPanel } from './src/components/AIAssistantPanel';
import { sshService, tmuxService } from './src/services';
import remoteLogger from './src/services/remoteLogger';

type AppScreen = Screen | 'serverEdit';

interface NavigationState {
  screen: AppScreen;
  server: Server | null;
  session: TmuxSession | null;
  window: TmuxWindow | null;
  editingServer: Server | null;
}

const SERVERS_STORAGE_KEY = '@TmuxMobile:servers';

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [nav, setNav] = useState<NavigationState>({
    screen: 'serverList',
    server: null,
    session: null,
    window: null,
    editingServer: null,
  });
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const stored = await AsyncStorage.getItem(SERVERS_STORAGE_KEY);
      if (stored) {
        setServers(JSON.parse(stored));
      }
    } catch {
    }
  };

  const saveServers = async (newServers: Server[]) => {
    try {
      await AsyncStorage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(newServers));
    } catch {
    }
  };

  const handleServerClick = useCallback(async (server: Server) => {
    remoteLogger.log('App', 'handleServerClick', { name: server.name, id: server.id });
    const connected = await sshService.connect(server);
    remoteLogger.log('App', 'SSH connect result', { connected });

    if (connected) {
      try {
        remoteLogger.log('App', 'Fetching tmux sessions...');
        const sessions = await tmuxService.listSessions(server.id);
        remoteLogger.log('App', 'Sessions fetched', { count: sessions.length, sessions });
        
        remoteLogger.log('App', 'Fetching server stats...');
        const stats = await tmuxService.getServerStats(server.id);
        remoteLogger.log('App', 'Stats fetched', { stats });

        const updatedServer: Server = {
          ...server,
          status: 'connected',
          sessions,
          stats,
        };

        setServers(prev => {
          const updated = prev.map(s => s.id === server.id ? updatedServer : s);
          saveServers(updated);
          return updated;
        });

        setNav({ screen: 'serverDetail', server: updatedServer, session: null, window: null, editingServer: null });
      } catch (error) {
        remoteLogger.error('App', 'Error fetching sessions/stats', { error: String(error) });
        setNav({ screen: 'serverDetail', server: { ...server, status: 'connected' }, session: null, window: null, editingServer: null });
      }
    } else {
      remoteLogger.log('App', 'SSH connection failed');
      setNav({ screen: 'serverDetail', server: { ...server, status: 'disconnected' }, session: null, window: null, editingServer: null });
    }
  }, []);

  const handleAddServer = useCallback(() => {
    setNav(prev => ({ ...prev, screen: 'serverEdit', editingServer: null }));
  }, []);

  const handleSaveServer = useCallback((server: Server) => {
    setServers(prev => {
      const exists = prev.find(s => s.id === server.id);
      const updated = exists
        ? prev.map(s => s.id === server.id ? server : s)
        : [...prev, server];
      saveServers(updated);
      return updated;
    });
    setNav({ screen: 'serverList', server: null, session: null, window: null, editingServer: null });
  }, []);

  const handleDeleteServer = useCallback((serverId: number) => {
    sshService.disconnect(serverId);
    setServers(prev => {
      const updated = prev.filter(s => s.id !== serverId);
      saveServers(updated);
      return updated;
    });
    setNav({ screen: 'serverList', server: null, session: null, window: null, editingServer: null });
  }, []);

  const handleBackToList = useCallback(() => {
    setNav({ screen: 'serverList', server: null, session: null, window: null, editingServer: null });
  }, []);

  const handleSessionClick = useCallback((session: TmuxSession, window: TmuxWindow) => {
    setNav((prev) => ({
      screen: 'terminal',
      server: prev.server,
      session,
      window,
      editingServer: null,
    }));
  }, []);

  const handleBackToDetail = useCallback(() => {
    setNav((prev) => ({
      screen: 'serverDetail',
      server: prev.server,
      session: null,
      window: null,
      editingServer: null,
    }));
  }, []);

  const handleOpenAI = useCallback(() => {
    setShowAI(true);
  }, []);

  const handleCloseAI = useCallback(() => {
    setShowAI(false);
  }, []);

  const handleCommandGenerated = useCallback((command: string) => {
    console.log('Command generated:', command);
  }, []);

  const renderScreen = () => {
    switch (nav.screen) {
      case 'serverList':
        return (
          <ServerListScreen
            servers={servers}
            onServerClick={handleServerClick}
            onAddServer={handleAddServer}
          />
        );
      case 'serverEdit':
        return (
          <ServerEditScreen
            server={nav.editingServer || undefined}
            onSave={handleSaveServer}
            onDelete={nav.editingServer ? handleDeleteServer : undefined}
            onBack={handleBackToList}
          />
        );
      case 'serverDetail':
        if (!nav.server) return null;
        return (
          <ServerDetailScreen
            server={nav.server}
            onBack={handleBackToList}
            onSessionClick={handleSessionClick}
          />
        );
      case 'terminal':
        if (!nav.server || !nav.session || !nav.window) return null;
        return (
          <TerminalScreen
            server={nav.server}
            session={nav.session}
            window={nav.window}
            onBack={handleBackToDetail}
            onOpenAI={handleOpenAI}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View className="flex-1 bg-slate-950">
      <StatusBar style="light" />
      {renderScreen()}
      <AIAssistantPanel
        visible={showAI}
        onClose={handleCloseAI}
        onCommandGenerated={handleCommandGenerated}
      />
    </View>
  );
}
