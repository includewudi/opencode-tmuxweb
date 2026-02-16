import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

interface CommandHistoryViewProps {
  onInput: (text: string) => void;
}

const COMMANDS = [
  { name: 'ls', cmd: 'ls -la\n' },
  { name: 'cd', cmd: 'cd ' },
  { name: 'grep', cmd: 'grep -r ' },
  { name: 'find', cmd: 'find . -name ' },
  { name: 'git', cmd: 'git status\n' },
  { name: 'docker', cmd: 'docker ps\n' },
  { name: 'npm', cmd: 'npm install\n' },
  { name: 'cat', cmd: 'cat ' },
];

export const CommandHistoryView: React.FC<CommandHistoryViewProps> = ({
  onInput,
}) => {
  return (
    <ScrollView className="flex-1 p-2">
      <View className="flex-row flex-wrap">
        {COMMANDS.map((item) => (
          <Pressable
            key={item.name}
            onPress={() => onInput(item.cmd)}
            className="px-3 py-1.5 m-1 bg-slate-800 rounded-md"
          >
            <Text className="text-slate-300 text-xs font-mono">{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
};
