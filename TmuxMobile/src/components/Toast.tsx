import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

interface ToastProps {
  message: string;
  visible: boolean;
  duration?: number;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  visible, 
  duration = 3000,
  onDismiss 
}) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View className="flex-row items-center bg-slate-700 px-3 py-2 rounded-md">
      <AlertCircle size={14} color="#fbbf24" />
      <Text className="ml-2 text-xs text-slate-200 flex-1">
        {message}
      </Text>
    </View>
  );
};
