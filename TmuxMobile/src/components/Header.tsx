import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { HeaderProps } from '../types';

export const Header: React.FC<HeaderProps> = ({
  title,
  leftIcon,
  rightIcon,
  onLeftClick,
  onRightClick,
}) => {
  return (
    <View className="h-14 flex-row items-center justify-between px-4 bg-slate-900 border-b border-slate-800">
      <Pressable
        onPress={onLeftClick}
        className="p-2 -ml-2 active:opacity-70"
        disabled={!onLeftClick}
      >
        <View className="text-slate-400">{leftIcon}</View>
      </Pressable>
      
      <Text className="text-base font-semibold text-slate-100">{title}</Text>
      
      <Pressable
        onPress={onRightClick}
        className="p-2 -mr-2 active:opacity-70"
        disabled={!onRightClick}
      >
        <View className="text-emerald-400">{rightIcon}</View>
      </Pressable>
    </View>
  );
};
