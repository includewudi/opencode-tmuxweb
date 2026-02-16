import React, { useState } from 'react';
import { View, Text, Pressable, LayoutChangeEvent } from 'react-native';
import { ChevronDown, ChevronUp, Keyboard, History } from 'lucide-react-native';
import { VirtualKeypadView } from './VirtualKeypadView';
import { CommandHistoryView } from './CommandHistoryView';

export type PanelTab = 'keys' | 'history' | 'closed';

interface TerminalInputPanelProps {
  onInput: (text: string) => void;
  isConnected: boolean;
}

export const TerminalInputPanel: React.FC<TerminalInputPanelProps> = ({
  onInput,
  isConnected,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('keys');

  if (activeTab === 'closed') {
    return (
      <View className="absolute bottom-0 right-0 p-3">
        <Pressable
          onPress={() => setActiveTab('keys')}
          className="p-3 bg-slate-800 rounded-full"
        >
          <Keyboard size={20} color="#94a3b8" />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="bg-slate-900 border-t border-slate-700">
      <View className="flex-row items-center justify-between px-2 py-1 border-b border-slate-700">
        <View className="flex-row">
          <Pressable
            onPress={() => setActiveTab('keys')}
            className={`flex-row items-center px-3 py-1.5 rounded-md ${activeTab === 'keys' ? 'bg-slate-700' : ''}`}
          >
            <Keyboard size={14} color={activeTab === 'keys' ? '#34d399' : '#94a3b8'} />
            <Text className={`ml-1.5 text-xs ${activeTab === 'keys' ? 'text-emerald-400' : 'text-slate-400'}`}>
              快捷键
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('history')}
            className={`flex-row items-center px-3 py-1.5 rounded-md ${activeTab === 'history' ? 'bg-slate-700' : ''}`}
          >
            <History size={14} color={activeTab === 'history' ? '#34d399' : '#94a3b8'} />
            <Text className={`ml-1.5 text-xs ${activeTab === 'history' ? 'text-emerald-400' : 'text-slate-400'}`}>
              历史
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setActiveTab('closed')}
          className="p-1.5 rounded-md"
        >
          <ChevronDown size={16} color="#64748b" />
        </Pressable>
      </View>

      <View style={{ height: 180 }}>
        {activeTab === 'keys' && (
          <VirtualKeypadView onInput={onInput} isConnected={isConnected} />
        )}
        {activeTab === 'history' && (
          <CommandHistoryView onInput={onInput} />
        )}
      </View>
    </View>
  );
};
