import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Server } from '../types';
import { ServerCard } from '../components/ServerCard';

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24);

interface ServerListScreenProps {
  servers: Server[];
  onServerClick: (server: Server) => void;
  onAddServer: () => void;
}

export const ServerListScreen: React.FC<ServerListScreenProps> = ({
  servers,
  onServerClick,
  onAddServer,
}) => {
  return (
    <View className="flex-1 bg-slate-950" style={{ paddingTop: STATUSBAR_HEIGHT }}>
      <ScrollView className="flex-1" contentContainerClassName="pb-20">
        <View className="px-5 pt-8 pb-4">
          <View className="flex-row justify-between items-end mb-6">
            <View>
              <Text className="text-3xl font-bold text-white tracking-tight">
                Servers
              </Text>
              <Text className="text-slate-400 text-sm mt-1">
                Remote connection manager
              </Text>
            </View>
            <TouchableOpacity
              onPress={onAddServer}
              activeOpacity={0.7}
              className="bg-indigo-600 p-2.5 rounded-xl"
            >
              <Plus size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {servers.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-slate-500 text-base mb-2">No servers configured</Text>
              <Text className="text-slate-600 text-sm">Tap + to add a server</Text>
            </View>
          ) : (
            <View className="gap-4">
              {servers.map(server => (
                <ServerCard key={server.id} server={server} onPress={onServerClick} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
