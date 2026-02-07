import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Server, Cpu, Activity, ChevronRight } from 'lucide-react-native';
import { ServerCardProps } from '../types';
import { StatusBadge } from './StatusBadge';

export const ServerCard: React.FC<ServerCardProps> = ({ server, onPress }) => {
  const isConnected = server.status === 'connected';

  return (
    <Pressable
      onPress={() => onPress(server)}
      className="flex-row items-center p-4 bg-slate-900/80 rounded-xl mb-3 border border-slate-800 active:bg-slate-800/80 active:scale-[0.98]"
    >
      <View className="w-12 h-12 rounded-lg bg-slate-800 items-center justify-center mr-3">
        <Server size={24} color={isConnected ? '#34d399' : '#64748b'} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-base font-semibold text-slate-100" numberOfLines={1}>
            {server.name}
          </Text>
          <StatusBadge status={server.status} />
        </View>

        <Text className="text-sm text-slate-400 mb-2">
          {server.user}@{server.ip}
        </Text>

        {isConnected && server.stats && (
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center">
              <Cpu size={14} color="#94a3b8" />
              <Text className="text-xs text-slate-400 ml-1">
                {server.stats.cpu}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Activity size={14} color="#94a3b8" />
              <Text className="text-xs text-slate-400 ml-1">
                {server.stats.ram}
              </Text>
            </View>

            <Text className="text-xs text-emerald-400">
              {server.sessions.length} session{server.sessions.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      <ChevronRight size={20} color="#64748b" />
    </Pressable>
  );
};
