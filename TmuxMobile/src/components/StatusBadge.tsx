import React from 'react';
import { View, Text } from 'react-native';
import { StatusBadgeProps } from '../types';

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const isConnected = status === 'connected';
  
  return (
    <View
      className={`flex-row items-center px-2 py-0.5 rounded ${
        isConnected ? 'bg-emerald-500/10' : 'bg-slate-700'
      }`}
    >
      <View
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          isConnected ? 'bg-emerald-400' : 'bg-slate-400'
        }`}
      />
      <Text
        className={`text-xs font-medium ${
          isConnected ? 'text-emerald-400' : 'text-slate-400'
        }`}
      >
        {isConnected ? 'Connected' : 'Offline'}
      </Text>
    </View>
  );
};
