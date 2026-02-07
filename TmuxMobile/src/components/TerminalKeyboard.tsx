import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TerminalKeyboardProps } from '../types';

interface KeyConfig {
  label: string;
  value: string;
  icon?: React.ReactNode;
  width?: 'normal' | 'wide';
}

const ROW_1: KeyConfig[] = [
  { label: 'Esc', value: 'Escape' },
  { label: 'Tab', value: 'Tab' },
  { label: 'Ctrl', value: 'Control' },
  { label: 'Alt', value: 'Alt' },
  { label: '↑', value: 'ArrowUp' },
  { label: '|', value: '|' },
  { label: '~', value: '~' },
  { label: '-', value: '-' },
];

const ROW_2: KeyConfig[] = [
  { label: '←', value: 'ArrowLeft' },
  { label: '↓', value: 'ArrowDown' },
  { label: '→', value: 'ArrowRight' },
  { label: ':', value: ':' },
  { label: '/', value: '/' },
  { label: '$', value: '$' },
  { label: '`', value: '`' },
  { label: 'Del', value: 'Delete' },
];

const ROW_3: KeyConfig[] = [
  { label: 'Split H', value: 'tmux:split-h', width: 'wide' },
  { label: 'Split V', value: 'tmux:split-v', width: 'wide' },
  { label: 'Zoom', value: 'tmux:zoom', width: 'wide' },
  { label: 'Next', value: 'tmux:next', width: 'wide' },
  { label: 'Prev', value: 'tmux:prev', width: 'wide' },
  { label: 'Detach', value: 'tmux:detach', width: 'wide' },
];

const KeyButton: React.FC<{
  config: KeyConfig;
  onPress: () => void;
}> = ({ config, onPress }) => {
  const isWide = config.width === 'wide';

  return (
    <Pressable
      onPress={onPress}
      className={`
        ${isWide ? 'flex-1 mx-0.5' : 'w-10'}
        h-10 items-center justify-center rounded-md
        bg-slate-800 border border-slate-700
        active:bg-slate-700
      `}
    >
      {config.icon ? (
        config.icon
      ) : (
        <Text className="text-slate-200 text-xs font-medium">
          {config.label}
        </Text>
      )}
    </Pressable>
  );
};

export const TerminalKeyboard: React.FC<TerminalKeyboardProps> = ({
  onKeyPress,
  onSpecialKey,
}) => {
  const handleKeyPress = (key: KeyConfig) => {
    if (key.value.startsWith('tmux:')) {
      onSpecialKey(key.value);
    } else {
      onKeyPress(key.value);
    }
  };

  return (
    <View className="bg-slate-900 border-t border-slate-800 px-2 py-2 pb-6">
      <View className="flex-row justify-between mb-1.5">
        {ROW_1.map((key) => (
          <KeyButton
            key={key.value}
            config={key}
            onPress={() => handleKeyPress(key)}
          />
        ))}
      </View>

      <View className="flex-row justify-between mb-1.5">
        {ROW_2.map((key) => (
          <KeyButton
            key={key.value}
            config={key}
            onPress={() => handleKeyPress(key)}
          />
        ))}
      </View>

      <View className="flex-row justify-between">
        {ROW_3.map((key) => (
          <KeyButton
            key={key.value}
            config={key}
            onPress={() => handleKeyPress(key)}
          />
        ))}
      </View>
    </View>
  );
};
