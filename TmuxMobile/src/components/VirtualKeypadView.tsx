import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface VirtualKeypadViewProps {
  onInput: (text: string) => void;
  isConnected: boolean;
}

const QUICK_KEYS = [
  ['Esc', 'Tab', '|', '/', '-', '~'],
  ['↑', '↓', '←', '→', '^C', 'clr'],
];

const SPECIAL_KEYS = [
  { label: 'tmux', data: '\x02' },
  { label: 'prev', data: '\x02p' },
  { label: 'next', data: '\x02n' },
  { label: 'det', data: '\x02d' },
];

export const VirtualKeypadView: React.FC<VirtualKeypadViewProps> = ({
  onInput,
  isConnected,
}) => {
  const handleKeyPress = (key: string) => {
    if (!isConnected) return;
    
    switch (key) {
      case 'Esc':
        onInput('\x1b');
        break;
      case 'Tab':
        onInput('\t');
        break;
      case '↑':
        onInput('\x1b[A');
        break;
      case '↓':
        onInput('\x1b[B');
        break;
      case '←':
        onInput('\x1b[D');
        break;
      case '→':
        onInput('\x1b[C');
        break;
      case '^C':
        onInput('\x03');
        break;
      case 'clr':
        onInput('\x15');
        break;
      default:
        onInput(key);
    }
  };

  const handleSpecialKey = (data: string) => {
    if (!isConnected) return;
    onInput(data);
  };

  return (
    <View className="flex-1 p-2">
      {QUICK_KEYS.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row mb-1">
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => handleKeyPress(key)}
              className="flex-1 py-2 mx-0.5 bg-slate-800 rounded items-center justify-center"
              disabled={!isConnected}
            >
              <Text className="text-slate-300 text-xs font-mono">{key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View className="flex-row mt-1">
        {SPECIAL_KEYS.map((key) => (
          <Pressable
            key={key.label}
            onPress={() => handleSpecialKey(key.data)}
            className="flex-1 py-2 mx-0.5 bg-slate-700 rounded items-center justify-center"
            disabled={!isConnected}
          >
            <Text className="text-emerald-400 text-xs font-mono">{key.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};
