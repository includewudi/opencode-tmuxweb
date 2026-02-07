import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { X, Send, Bot, Loader2, Copy, Check, Sparkles } from 'lucide-react-native';
import { AIAssistantPanelProps } from '../types';
import { callGeminiAPI } from '../services/gemini';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.55;

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  visible,
  onClose,
  onCommandGenerated,
}) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        inputRef.current?.focus();
      });
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: PANEL_HEIGHT,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleSend = useCallback(async () => {
    if (!query.trim() || isLoading) return;
    
    setIsLoading(true);
    setResponse('');
    setCopied(false);
    
    const result = await callGeminiAPI(query.trim());
    setResponse(result);
    setIsLoading(false);
  }, [query, isLoading]);

  const handleCopy = useCallback(async () => {
    if (!response || response.startsWith('Error:')) return;
    
    await Clipboard.setStringAsync(response);
    setCopied(true);
    onCommandGenerated(response);
    
    setTimeout(() => setCopied(false), 2000);
  }, [response, onCommandGenerated]);

  const handleClose = useCallback(() => {
    setQuery('');
    setResponse('');
    setCopied(false);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50">
      {/* Overlay */}
      <Animated.View 
        style={{ opacity: fadeAnim }}
        className="absolute inset-0 bg-black/70"
      >
        <TouchableOpacity 
          className="flex-1"
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Panel */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="absolute bottom-0 left-0 right-0"
      >
        <Animated.View
          style={{
            transform: [{ translateY: slideAnim }],
            height: PANEL_HEIGHT,
          }}
          className="bg-slate-900 rounded-t-3xl border-t border-x border-slate-700 overflow-hidden"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-violet-600/20 items-center justify-center mr-3">
                <Sparkles size={18} color="#a78bfa" />
              </View>
              <Text className="text-slate-100 font-semibold text-lg">
                AI Command Assistant
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.7}
              className="w-8 h-8 rounded-lg bg-slate-800 items-center justify-center"
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="flex-1 px-5 py-4">
            {/* Input Row */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 flex-row items-center bg-slate-800 rounded-xl border border-slate-700 px-4 py-3 mr-3">
                <Bot size={18} color="#64748b" />
                <TextInput
                  ref={inputRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Describe what you want to do..."
                  placeholderTextColor="#475569"
                  className="flex-1 text-slate-100 text-base ml-3"
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  editable={!isLoading}
                />
              </View>
              <TouchableOpacity
                onPress={handleSend}
                activeOpacity={0.7}
                disabled={!query.trim() || isLoading}
                className={`w-12 h-12 rounded-xl items-center justify-center ${
                  query.trim() && !isLoading ? 'bg-violet-600' : 'bg-slate-800'
                }`}
              >
                {isLoading ? (
                  <Loader2 size={20} color="#a78bfa" />
                ) : (
                  <Send size={20} color={query.trim() ? '#fff' : '#64748b'} />
                )}
              </TouchableOpacity>
            </View>

            {/* Response Area */}
            {(response || isLoading) && (
              <View className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
                {isLoading ? (
                  <View className="flex-row items-center justify-center py-6">
                    <Animated.View
                      style={{
                        transform: [{ 
                          rotate: slideAnim.interpolate({
                            inputRange: [0, PANEL_HEIGHT],
                            outputRange: ['0deg', '360deg'],
                          })
                        }]
                      }}
                    >
                      <Loader2 size={24} color="#a78bfa" />
                    </Animated.View>
                    <Text className="text-slate-400 ml-3">Generating command...</Text>
                  </View>
                ) : (
                  <View>
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="text-slate-500 text-xs mb-2 uppercase tracking-wider">
                          Generated Command
                        </Text>
                        <Text 
                          className={`font-mono text-base ${
                            response.startsWith('Error:') ? 'text-red-400' : 'text-emerald-400'
                          }`}
                          selectable
                        >
                          {response}
                        </Text>
                      </View>
                      {!response.startsWith('Error:') && (
                        <TouchableOpacity
                          onPress={handleCopy}
                          activeOpacity={0.7}
                          className={`w-10 h-10 rounded-lg items-center justify-center ${
                            copied ? 'bg-emerald-600/20' : 'bg-slate-700'
                          }`}
                        >
                          {copied ? (
                            <Check size={18} color="#34d399" />
                          ) : (
                            <Copy size={18} color="#94a3b8" />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Hint when empty */}
            {!response && !isLoading && (
              <View className="flex-1 items-center justify-center opacity-50">
                <Bot size={48} color="#475569" />
                <Text className="text-slate-500 text-center mt-4 text-sm leading-relaxed">
                  Describe what you want to accomplish{'\n'}
                  and I'll generate the command for you
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};
