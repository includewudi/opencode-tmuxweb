import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform, StatusBar } from 'react-native';
import {
  Settings,
  Folder,
  Monitor,
  ChevronRight,
  ChevronDown,
  Hash,
  Cpu,
  Activity,
  ArrowLeft,
} from 'lucide-react-native';
import { Server, TmuxSession, TmuxWindow } from '../types';
import { Header } from '../components/Header';

interface ServerDetailScreenProps {
  server: Server;
  onBack: () => void;
  onSessionClick: (session: TmuxSession, window: TmuxWindow) => void;
}

export const ServerDetailScreen: React.FC<ServerDetailScreenProps> = ({
  server,
  onBack,
  onSessionClick,
}) => {
  const [expandedSessions, setExpandedSessions] = useState<string[]>(
    server.sessions.length > 0 ? [server.sessions[0].id] : []
  );

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const isExpanded = (sessionId: string) => expandedSessions.includes(sessionId);

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  return (
    <View className="flex-1 bg-slate-950" style={{ paddingTop: statusBarHeight }}>
      <Header
        title={server.name}
        leftIcon={<ArrowLeft size={22} color="#94a3b8" />}
        rightIcon={<Settings size={22} color="#34d399" />}
        onLeftClick={onBack}
        onRightClick={() => {}}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-slate-900/80 rounded-2xl p-5 mb-5 border border-slate-800/60">
          <View className="flex-row items-center mb-4">
            <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
            <Text className="text-emerald-400 text-sm font-medium">Connected</Text>
          </View>

          <View className="flex-row">
            <View className="flex-1 items-center py-3 border-r border-slate-800/60">
              <Activity size={18} color="#818cf8" />
              <Text className="text-slate-400 text-xs mt-2 mb-1">Uptime</Text>
              <Text className="text-slate-100 text-base font-semibold">24d 7h</Text>
            </View>

            <View className="flex-1 items-center py-3 border-r border-slate-800/60">
              <Cpu size={18} color="#f472b6" />
              <Text className="text-slate-400 text-xs mt-2 mb-1">CPU</Text>
              <Text className="text-slate-100 text-base font-semibold">
                {server.stats?.cpu || '--'}
              </Text>
            </View>

            <View className="flex-1 items-center py-3">
              <Hash size={18} color="#fbbf24" />
              <Text className="text-slate-400 text-xs mt-2 mb-1">RAM</Text>
              <Text className="text-slate-100 text-base font-semibold">
                {server.stats?.ram || '--'}
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-slate-300 text-base font-semibold tracking-wide">
            Sessions
          </Text>
          <View className="bg-indigo-500/20 px-2.5 py-1 rounded-full">
            <Text className="text-indigo-400 text-xs font-medium">
              {server.sessions.length}
            </Text>
          </View>
        </View>

        <View className="bg-slate-900/60 rounded-2xl overflow-hidden border border-slate-800/40">
          {server.sessions.map((session, index) => (
            <View key={session.id}>
              <Pressable
                onPress={() => toggleSession(session.id)}
                className="flex-row items-center px-4 py-3.5 active:bg-slate-800/50"
              >
                <View className="w-6 h-6 items-center justify-center mr-2">
                  {isExpanded(session.id) ? (
                    <ChevronDown size={18} color="#64748b" />
                  ) : (
                    <ChevronRight size={18} color="#64748b" />
                  )}
                </View>

                <View className="w-8 h-8 rounded-lg bg-amber-500/15 items-center justify-center mr-3">
                  <Folder size={16} color="#fbbf24" />
                </View>

                <View className="flex-1">
                  <Text className="text-slate-100 text-sm font-medium">
                    {session.name}
                  </Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    {session.windows} window{session.windows !== 1 ? 's' : ''}
                  </Text>
                </View>

                {session.active && (
                  <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full">
                    <Text className="text-emerald-400 text-xs font-medium">
                      active
                    </Text>
                  </View>
                )}
              </Pressable>

              {isExpanded(session.id) && session.structure.length > 0 && (
                <View className="bg-slate-950/40 border-t border-slate-800/30">
                  {session.structure.map((window) => (
                    <Pressable
                      key={window.id}
                      onPress={() => onSessionClick(session, window)}
                      className="flex-row items-center pl-14 pr-4 py-3 active:bg-slate-800/40"
                    >
                      <View className="w-7 h-7 rounded-md bg-cyan-500/15 items-center justify-center mr-3">
                        <Monitor size={14} color="#22d3ee" />
                      </View>

                      <View className="flex-1">
                        <Text className="text-slate-200 text-sm">
                          {window.index}: {window.name}
                        </Text>
                      </View>

                      <View className="bg-slate-700/50 px-2 py-0.5 rounded-full flex-row items-center">
                        <Hash size={10} color="#94a3b8" />
                        <Text className="text-slate-400 text-xs ml-1">
                          {window.panes}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {index < server.sessions.length - 1 && (
                <View className="h-px bg-slate-800/40 ml-14" />
              )}
            </View>
          ))}

          {server.sessions.length === 0 && (
            <View className="py-12 items-center">
              <Folder size={32} color="#475569" />
              <Text className="text-slate-500 text-sm mt-3">No sessions found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
