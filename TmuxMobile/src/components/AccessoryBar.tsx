import React, { useState, useCallback } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Copy } from 'lucide-react-native';
import { Toast } from './Toast';

interface AccessoryBarProps {
  onPaste: (text: string) => void;
  isConnected: boolean;
}

export const AccessoryBar: React.FC<AccessoryBarProps> = ({ onPaste, isConnected }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const displayToast = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
  }, []);

  const dismissToast = useCallback(() => {
    setShowToast(false);
  }, []);

  const handlePaste = useCallback(async () => {
    if (!isConnected) {
      displayToast('Not connected to terminal');
      return;
    }

    try {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        displayToast('Clipboard not available. Long-press to paste.');
        return;
      }

      // Request clipboard text (requires user gesture)
      const text = await navigator.clipboard.readText();
      
      if (text && text.trim()) {
        onPaste(text);
      } else {
        displayToast('Clipboard is empty');
      }
    } catch (err) {
      const error = err as Error;
      // Graceful fallback for permission denied or other errors
      if (error.name === 'NotAllowedError') {
        displayToast('Clipboard access denied. Long-press to paste.');
      } else if (error.name === 'NotFoundError') {
        displayToast('Clipboard is empty');
      } else {
        displayToast('Clipboard error: ' + error.message);
      }
    }
  }, [isConnected, onPaste, displayToast]);

  return (
    <View className="bg-slate-900 border-t border-slate-800 px-3 py-2">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={handlePaste}
          disabled={!isConnected}
          className={`
            flex-row items-center px-3 py-2 rounded-md
            ${isConnected 
              ? 'bg-slate-800 active:bg-slate-700' 
              : 'bg-slate-800/50 opacity-50'}
          `}
        >
          <Copy size={16} color={isConnected ? '#64748b' : '#475569'} />
          <Text 
            className={`ml-2 text-sm font-medium ${
              isConnected ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            Paste
          </Text>
        </Pressable>

        {toastMessage && (
          <Toast 
            message={toastMessage} 
            visible={showToast} 
            onDismiss={dismissToast}
          />
        )}
      </View>
    </View>
  );
};
