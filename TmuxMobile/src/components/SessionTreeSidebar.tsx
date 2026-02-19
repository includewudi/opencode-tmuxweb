import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform, StatusBar } from 'react-native';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Monitor,
  Hash,
  Plus,
  Server as ServerIcon,
} from 'lucide-react-native';
import { Server, TmuxSession, TmuxWindow } from '../types';

interface SessionTreeSidebarProps {
  navigation: any;
  state: any;
  servers: Server[];
  onServerClick: (server: Server) => Promise<void>;
  onAddServer: () => void;
}

export function SessionTreeSidebar({
  navigation,
  servers,
  onServerClick,
  onAddServer,
}: SessionTreeSidebarProps) {
  const connectedServer = useMemo(
    () => servers.find((s) => s.status === 'connected'),
    [servers],
  );

  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!connectedServer) {
      setExpandedSessions(new Set());
      return;
    }

    if (connectedServer.sessions.length > 0) {
      const first = connectedServer.sessions[0];
      setExpandedSessions((prev) => {
        if (prev.size > 0) return prev;
        return new Set([first.id]);
      });
    }
  }, [connectedServer]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleSessionWindowClick = (server: Server, session: TmuxSession, window: TmuxWindow) => {
    navigation.navigate('Terminal', {
      server,
      session,
      window,
      allWindows: session.structure,
    });
    navigation.closeDrawer();
  };

  const handleServerPress = async (server: Server) => {
    await onServerClick(server);
  };

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 50;

  return (
    <View className="flex-1 bg-slate-950" style={{ paddingTop: statusBarHeight }}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
        <View className="flex-row items-center gap-2">
          <ServerIcon size={20} color="#818cf8" />
          <Text className="text-white text-base font-bold tracking-wider">TMUX</Text>
        </View>
        <Pressable onPress={onAddServer} className="p-2 rounded-lg active:bg-slate-800">
          <Plus size={20} color="#94a3b8" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {connectedServer ? (
          <View className="py-2">
            <View className="flex-row items-center px-4 py-2 mb-2">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
              <Text className="text-emerald-400 text-sm font-medium">{connectedServer.name}</Text>
            </View>

            {connectedServer.sessions.length === 0 ? (
              <View className="items-center py-8">
                <Folder size={28} color="#475569" />
                <Text className="text-slate-500 text-sm mt-2">No sessions found</Text>
              </View>
            ) : (
              connectedServer.sessions.map((session) => (
                <View key={session.id}>
                  <Pressable
                    onPress={() => toggleSession(session.id)}
                    className="flex-row items-center px-4 py-3 active:bg-slate-800/50"
                  >
                    <View className="w-5 items-center mr-2">
                      {expandedSessions.has(session.id) ? (
                        <ChevronDown size={16} color="#64748b" />
                      ) : (
                        <ChevronRight size={16} color="#64748b" />
                      )}
                    </View>
                    <View className="w-7 h-7 rounded-lg bg-amber-500/15 items-center justify-center mr-3">
                      <Folder size={14} color="#fbbf24" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-100 text-sm font-medium">{session.name}</Text>
                      <Text className="text-slate-500 text-xs mt-0.5">
                        {session.windows} window{session.windows !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {session.active && (
                      <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full">
                        <Text className="text-emerald-400 text-xs">active</Text>
                      </View>
                    )}
                  </Pressable>

                  {expandedSessions.has(session.id) && session.structure.length > 0 && (
                    <View className="bg-slate-950/40">
                      {session.structure.map((window) => (
                        <Pressable
                          key={window.id}
                          onPress={() => handleSessionWindowClick(connectedServer, session, window)}
                          className="flex-row items-center pl-14 pr-4 py-2.5 active:bg-slate-800/40"
                        >
                          <View className="w-6 h-6 rounded-md bg-cyan-500/15 items-center justify-center mr-3">
                            <Monitor size={12} color="#22d3ee" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-slate-200 text-sm">
                              {window.index}: {window.name}
                            </Text>
                          </View>
                          <View className="bg-slate-700/50 px-2 py-0.5 rounded-full flex-row items-center">
                            <Hash size={10} color="#94a3b8" />
                            <Text className="text-slate-400 text-xs ml-1">{window.panes}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="py-2">
            {servers.length === 0 ? (
              <View className="items-center py-12">
                <ServerIcon size={32} color="#475569" />
                <Text className="text-slate-500 text-sm mt-3">No servers configured</Text>
                <Pressable
                  onPress={onAddServer}
                  className="mt-3 px-4 py-2 bg-indigo-600 rounded-xl active:bg-indigo-700"
                >
                  <Text className="text-white text-sm font-medium">Add Server</Text>
                </Pressable>
              </View>
            ) : (
              servers.map((server) => (
                <Pressable
                  key={server.id}
                  onPress={() => handleServerPress(server)}
                  className="flex-row items-center px-4 py-3.5 active:bg-slate-800/50 border-b border-slate-800/30"
                >
                  <View className="w-9 h-9 rounded-xl bg-indigo-500/15 items-center justify-center mr-3">
                    <ServerIcon size={18} color="#818cf8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-100 text-sm font-medium">{server.name}</Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      {server.user}@{server.ip}:{server.port}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#475569" />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
        <View className="flex-row items-center gap-3">
          <View className="w-7 h-7 rounded-full bg-indigo-600 items-center justify-center">
            <Text className="text-xs font-bold text-white">T</Text>
          </View>
          <View>
            <Text className="text-xs text-white font-medium">TmuxMobile</Text>
            <Text className="text-[10px] text-slate-500">
              {servers.length} server{servers.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
