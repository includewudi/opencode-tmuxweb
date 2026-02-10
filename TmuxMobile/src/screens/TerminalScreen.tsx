import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Alert, LayoutChangeEvent, AppState } from 'react-native';
import { ChevronLeft, Keyboard, Sparkles } from 'lucide-react-native';
import { Header } from '../components/Header';
import { TerminalKeyboard } from '../components/TerminalKeyboard';
import { AccessoryBar } from '../components/AccessoryBar';
import { XtermTerminal, XtermTerminalRef } from '../components/XtermTerminal';
import { sshService, tmuxService } from '../services';
import remoteLogger from '../services/remoteLogger';
import { ReconnectStateMachine, ReconnectContext } from '../utils/reconnectStateMachine';
import { Server, TmuxSession, TmuxWindow } from '../types';

interface TerminalScreenProps {
  server: Server;
  session: TmuxSession;
  window: TmuxWindow;
  onBack: () => void;
  onOpenAI: () => void;
}

export const TerminalScreen: React.FC<TerminalScreenProps> = ({
  server,
  session,
  window: tmuxWindow,
  onBack,
  onOpenAI,
}) => {
  const [inputBuffer, setInputBuffer] = useState('');
  const [showSystemKeyboard, setShowSystemKeyboard] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [terminalReady, setTerminalReady] = useState(false);
  const [reconnectingState, setReconnectingState] = useState<ReconnectContext | null>(null);
  const terminalRef = useRef<XtermTerminalRef>(null);
  const inputRef = useRef<TextInput>(null);
  const terminalDimensions = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });
  const reconnectMachineRef = useRef<ReconnectStateMachine | null>(null);

  const handleTerminalReady = useCallback(() => {
    setTerminalReady(true);
  }, []);

  // Initialize reconnect state machine with callbacks
  useEffect(() => {
    const handleReconnectAttempt = async (): Promise<boolean> => {
      try {
        remoteLogger.log('TerminalScreen', 'Reconnect attempt starting', {
          serverId: server.id,
          sessionName: session.name,
          windowIndex: tmuxWindow.index,
        });

        // Disconnect any existing connection
        sshService.disconnect(server.id);
        
        // Wait briefly for disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reconnect and attach to window
        const connected = await sshService.connect(server);
        if (!connected) {
          terminalRef.current?.write('\x1b[31mReconnect failed: Could not connect to server\x1b[0m\r\n');
          return false;
        }

        const { cols, rows } = terminalDimensions.current;
        await tmuxService.attachToWindow(server.id, session.name, tmuxWindow.index, cols, rows);
        
        remoteLogger.log('TerminalScreen', 'Reconnect successful', {
          serverId: server.id,
        });
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        remoteLogger.log('TerminalScreen', 'Reconnect attempt failed', {
          error: errorMessage,
        });
        terminalRef.current?.write(`\x1b[31mReconnect error: ${errorMessage}\x1b[0m\r\n`);
        return false;
      }
    };

    const handleStateChange = (context: ReconnectContext) => {
      remoteLogger.log('TerminalScreen', 'Reconnect state changed', {
        state: context.state,
        attemptCount: context.attemptCount,
        maxAttempts: context.maxAttempts,
        error: context.lastError,
      });

      setReconnectingState(context);

      // Show status message in terminal based on state
      if (context.state === 'reconnecting') {
        const statusMsg = `\x1b[33mAttempting to reconnect (${context.attemptCount}/${context.maxAttempts})...\x1b[0m\r\n`;
        terminalRef.current?.write(statusMsg);
      } else if (context.state === 'connected') {
        terminalRef.current?.write('\x1b[32mReconnected successfully!\x1b[0m\r\n');
      } else if (context.state === 'failed') {
        const failMsg = `\x1b[31mReconnection failed: ${context.lastError}\x1b[0m\r\n`;
        terminalRef.current?.write(failMsg);
      }
    };

    reconnectMachineRef.current = new ReconnectStateMachine(undefined, {
      onReconnectAttempt: handleReconnectAttempt,
      onStateChange: handleStateChange,
    });

    remoteLogger.log('TerminalScreen', 'ReconnectStateMachine initialized');

    return () => {
      reconnectMachineRef.current?.destroy();
      reconnectMachineRef.current = null;
    };
  }, [server, session.name, tmuxWindow.index]);

  const [layoutReady, setLayoutReady] = useState(false);

  const handleTerminalLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const CHAR_WIDTH = 9;
    const CHAR_HEIGHT = 17;
    const cols = Math.floor(width / CHAR_WIDTH);
    const rows = Math.floor(height / CHAR_HEIGHT);
    
    remoteLogger.log('TerminalScreen', 'Layout', { width, height, cols, rows });
    
    if (cols > 0 && rows > 0 && 
        (cols !== terminalDimensions.current.cols || rows !== terminalDimensions.current.rows)) {
      terminalDimensions.current = { cols, rows };
      remoteLogger.log('TerminalScreen', 'Resizing terminal', { cols, rows });
      terminalRef.current?.resize(cols, rows);
    }
    
    if (!layoutReady && cols > 0 && rows > 0) {
      setLayoutReady(true);
    }
  }, [layoutReady]);

  const connectAndAttach = useCallback(async () => {
    setIsConnecting(true);
    terminalRef.current?.write('Connecting to server...\r\n');

    try {
      if (!sshService.isConnected(server.id)) {
        const connected = await sshService.connect(server);
        if (!connected) {
          terminalRef.current?.write('\x1b[31mFailed to connect to server\x1b[0m\r\n');
          setIsConnecting(false);
          return;
        }
      }

      terminalRef.current?.write('Connected. Attaching to tmux session...\r\n');
      const { cols, rows } = terminalDimensions.current;
      await tmuxService.attachToWindow(server.id, session.name, tmuxWindow.index, cols, rows);
      setIsConnected(true);
      terminalRef.current?.clear();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      terminalRef.current?.write(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);
    } finally {
      setIsConnecting(false);
    }
  }, [server, session.name, tmuxWindow.index]);

  const debugCountRef = useRef(0);
  
  useEffect(() => {
    const unsubscribe = sshService.onShellOutput(server.id, (data) => {
      debugCountRef.current++;
      if (debugCountRef.current <= 100) {
        const charCodes = Array.from(data).slice(0, 50).map(c => c.charCodeAt(0));
        remoteLogger.log('TerminalScreen', `Shell data #${debugCountRef.current}`, { 
          len: data.length, 
          codes: charCodes,
          preview: data.slice(0, 100).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
        });
      }
      terminalRef.current?.write(data);
    });

    const unsubscribeError = sshService.onError(server.id, (error) => {
      terminalRef.current?.write(`\x1b[31mError: ${error.message}\x1b[0m\r\n`);
    });

    return () => {
      unsubscribe();
      unsubscribeError();
    };
  }, [server.id]);

   useEffect(() => {
     if (layoutReady) {
       connectAndAttach();
     }
   }, [layoutReady, connectAndAttach]);

    useEffect(() => {
      remoteLogger.log('TerminalScreen', 'Setting up AppState listener');
      
      const subscription = AppState.addEventListener('change', (state) => {
        remoteLogger.log('TerminalScreen', 'AppState changed', { state });
        
        if (state === 'active') {
          // Check connection health when app returns to foreground
          const isHealthy = sshService.isConnected(server.id);
          remoteLogger.log('TerminalScreen', 'App returned to foreground', { 
            isConnected: isHealthy,
            serverId: server.id 
          });
          
          if (!isHealthy) {
            // Trigger reconnect via reconnectStateMachine
            reconnectMachineRef.current?.triggerReconnect();
          }
        }
      });

      return () => {
        remoteLogger.log('TerminalScreen', 'Cleaning up AppState listener');
        subscription.remove();
      };
    }, [server.id]);

  const sendToShell = useCallback(async (data: string) => {
    if (!isConnected) return;

    try {
      await sshService.writeToShell(server.id, data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      terminalRef.current?.write(`\x1b[31mSend error: ${errorMessage}\x1b[0m\r\n`);
    }
  }, [server.id, isConnected]);

  const handleKeyPress = useCallback((key: string) => {
    if (key === 'Delete') {
      sendToShell('\x7f');
    } else if (key === 'Enter') {
      sendToShell('\r');
    } else if (key === 'Space') {
      sendToShell(' ');
    } else {
      sendToShell(key);
    }
  }, [sendToShell]);

  const handleSpecialKey = useCallback((key: string) => {
    switch (key) {
      case 'Escape':
        sendToShell('\x1b');
        break;
      case 'Tab':
        sendToShell('\t');
        break;
      case 'Control':
        break;
      case 'ArrowUp':
        sendToShell('\x1b[A');
        break;
      case 'ArrowDown':
        sendToShell('\x1b[B');
        break;
      case 'ArrowRight':
        sendToShell('\x1b[C');
        break;
      case 'ArrowLeft':
        sendToShell('\x1b[D');
        break;
      case 'tmux-prefix':
        sendToShell('\x02');
        break;
      case 'tmux-prev':
        sendToShell('\x02p');
        break;
      case 'tmux-next':
        sendToShell('\x02n');
        break;
      case 'tmux-detach':
        sendToShell('\x02d');
        break;
    }
  }, [sendToShell]);

  const handleSystemKeyboardInput = useCallback((text: string) => {
    const lastChar = text.slice(-1);
    if (text.length > inputBuffer.length) {
      sendToShell(lastChar);
    } else if (text.length < inputBuffer.length) {
      sendToShell('\x7f');
    }
    setInputBuffer(text);
  }, [inputBuffer, sendToShell]);

  const handlePaste = useCallback((pastedText: string) => {
    sendToShell(pastedText);
  }, [sendToShell]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            // Cancel any ongoing reconnect attempts
            reconnectMachineRef.current?.cancel();
            sshService.closeShell(server.id);
            onBack();
          },
        },
      ]
    );
  }, [server.id, onBack]);

  const toggleSystemKeyboard = () => {
    setShowSystemKeyboard(!showSystemKeyboard);
    if (!showSystemKeyboard) {
      inputRef.current?.focus();
    } else {
      inputRef.current?.blur();
    }
  };

  const windowTitle = `${tmuxWindow.name} (${tmuxWindow.panes} pane${tmuxWindow.panes !== 1 ? 's' : ''})`;

  return (
    <View className="flex-1 bg-black">
      <Header
        title={windowTitle}
        leftIcon={<ChevronLeft size={24} color="#94a3b8" />}
        rightIcon={<Sparkles size={20} color="#34d399" />}
        onLeftClick={handleDisconnect}
        onRightClick={onOpenAI}
      />

      <View className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-3 py-2 border-b border-slate-800/50">
          <Text className="text-xs text-slate-500" style={{ fontFamily: 'monospace' }}>
            {server.user}@{server.ip} • {session.name}
            {isConnecting && ' (connecting...)'}
            {!isConnecting && !isConnected && ' (disconnected)'}
          </Text>
          <Pressable
            onPress={toggleSystemKeyboard}
            className="p-1.5 rounded active:bg-slate-800"
          >
            <Keyboard size={18} color={showSystemKeyboard ? '#34d399' : '#64748b'} />
          </Pressable>
        </View>

        <View className="flex-1" onLayout={handleTerminalLayout}>
          <XtermTerminal 
            ref={terminalRef} 
            onReady={handleTerminalReady}
          />
        </View>

        <AccessoryBar onPaste={handlePaste} isConnected={isConnected} />

        {showSystemKeyboard && (
          <TextInput
            ref={inputRef}
            value={inputBuffer}
            onChangeText={handleSystemKeyboardInput}
            autoCapitalize="none"
            autoCorrect={false}
            className="absolute opacity-0"
            style={{ height: 1, width: 1 }}
          />
        )}
      </View>

      <TerminalKeyboard onKeyPress={handleKeyPress} onSpecialKey={handleSpecialKey} />
    </View>
  );
};
