import "./global.css";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef } from '@react-navigation/native';
import { Server } from './src/types';
import { AppNavigator, DrawerParamList } from './src/navigation/AppNavigator';
import { AIAssistantPanel } from './src/components/AIAssistantPanel';
import { sshService, tmuxService } from './src/services';
import remoteLogger from './src/services/remoteLogger';

const SERVERS_STORAGE_KEY = '@TmuxMobile:servers';

export default function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [showAI, setShowAI] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<DrawerParamList>>(null);

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

        setServers((prev) => {
          const updated = prev.map((s) => (s.id === server.id ? updatedServer : s));
          saveServers(updated);
          return updated;
        });

        navigationRef.current?.navigate('ServerDetail', { server: updatedServer });
      } catch (error) {
        remoteLogger.error('App', 'Error fetching sessions/stats', { error: String(error) });
        const updatedServer: Server = { ...server, status: 'connected' };
        navigationRef.current?.navigate('ServerDetail', { server: updatedServer });
      }
    } else {
      remoteLogger.log('App', 'SSH connection failed');
      const updatedServer: Server = { ...server, status: 'disconnected' };
      navigationRef.current?.navigate('ServerDetail', { server: updatedServer });
    }
  }, []);

  const handleAddServer = useCallback(() => {
    navigationRef.current?.navigate('ServerEdit');
  }, []);

  const handleSaveServer = useCallback((server: Server) => {
    setServers((prev) => {
      const exists = prev.find((s) => s.id === server.id);
      const updated = exists ? prev.map((s) => (s.id === server.id ? server : s)) : [...prev, server];
      saveServers(updated);
      return updated;
    });
    navigationRef.current?.navigate('ServerList');
  }, []);

  const handleDeleteServer = useCallback((serverId: number) => {
    sshService.disconnect(serverId);
    setServers((prev) => {
      const updated = prev.filter((s) => s.id !== serverId);
      saveServers(updated);
      return updated;
    });
    navigationRef.current?.navigate('ServerList');
  }, []);

  const handleCommandGenerated = useCallback((command: string) => {
    console.log('Command generated:', command);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-slate-950">
        <StatusBar style="light" />
        <AppNavigator
          ref={navigationRef}
          servers={servers}
          onServerClick={handleServerClick}
          onAddServer={handleAddServer}
          onSaveServer={handleSaveServer}
          onDeleteServer={handleDeleteServer}
          onOpenAI={() => setShowAI(true)}
        />
        <AIAssistantPanel
          visible={showAI}
          onClose={() => setShowAI(false)}
          onCommandGenerated={handleCommandGenerated}
        />
      </View>
    </GestureHandlerRootView>
  );
}
