import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, StatusBar } from 'react-native';
import { ChevronLeft, Save, Trash2, Lock } from 'lucide-react-native';
import { Server } from '../types';
import { storePassword, getPassword, deletePassword } from '../storage/secureStorage';

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24);

interface ServerEditScreenProps {
  server?: Server;
  onSave: (server: Server) => void;
  onDelete?: (serverId: number) => void;
  onBack: () => void;
}

export const ServerEditScreen: React.FC<ServerEditScreenProps> = ({
  server,
  onSave,
  onDelete,
  onBack,
}) => {
  const isNew = !server;

  const [name, setName] = useState(server?.name || '');
  const [ip, setIp] = useState(server?.ip || '');
  const [port, setPort] = useState(server?.port?.toString() || '22');
  const [user, setUser] = useState(server?.user || '');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState(server?.credentials?.privateKey || '');
  const [hasStoredPassword, setHasStoredPassword] = useState(false);

  useEffect(() => {
    if (server?.ip && server?.port && server?.user) {
      getPassword(server.ip, server.port, server.user).then((stored) => {
        if (stored) {
          setPassword(stored);
          setHasStoredPassword(true);
        }
      });
    }
  }, [server]);

  const handleSave = async () => {
    if (!name.trim() || !ip.trim() || !user.trim()) {
      Alert.alert('Error', 'Name, IP, and username are required');
      return;
    }

    if (!password.trim() && !privateKey.trim()) {
      Alert.alert('Error', 'Either password or private key is required');
      return;
    }

    const parsedPort = parseInt(port, 10) || 22;
    
    if (password.trim()) {
      await storePassword(ip.trim(), parsedPort, user.trim(), password.trim());
    }

    const newServer: Server = {
      id: server?.id || Date.now(),
      name: name.trim(),
      ip: ip.trim(),
      port: parsedPort,
      user: user.trim(),
      status: 'disconnected',
      stats: null,
      sessions: [],
      credentials: {
        password: password.trim() ? '***STORED***' : undefined,
        privateKey: privateKey.trim() || undefined,
      },
    };

    onSave(newServer);
  };

  const handleDelete = async () => {
    if (!server || !onDelete) return;

    Alert.alert(
      'Delete Server',
      `Are you sure you want to delete "${server.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePassword(server.ip, server.port, server.user);
            onDelete(server.id);
          },
        },
      ]
    );
  };

  const inputStyle = "bg-slate-800 text-white px-4 py-3 rounded-xl text-base";

  return (
    <View className="flex-1 bg-slate-950" style={{ paddingTop: STATUSBAR_HEIGHT }}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
        <TouchableOpacity onPress={onBack} className="p-2">
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-white">
          {isNew ? 'Add Server' : 'Edit Server'}
        </Text>
        <TouchableOpacity onPress={handleSave} className="p-2">
          <Save size={22} color="#34d399" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5 py-6">
        <View className="gap-5">
          <View>
            <Text className="text-slate-400 text-sm mb-2 ml-1">Server Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="My Server"
              placeholderTextColor="#64748b"
              className={inputStyle}
            />
          </View>

          <View>
            <Text className="text-slate-400 text-sm mb-2 ml-1">Host / IP Address</Text>
            <TextInput
              value={ip}
              onChangeText={setIp}
              placeholder="192.168.1.1 or example.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="url"
              className={inputStyle}
            />
          </View>

          <View>
            <Text className="text-slate-400 text-sm mb-2 ml-1">Port</Text>
            <TextInput
              value={port}
              onChangeText={setPort}
              placeholder="22"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              className={inputStyle}
            />
          </View>

          <View>
            <Text className="text-slate-400 text-sm mb-2 ml-1">Username</Text>
            <TextInput
              value={user}
              onChangeText={setUser}
              placeholder="root"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              className={inputStyle}
            />
          </View>

          <View className="border-t border-slate-800 my-2" />
          <Text className="text-slate-500 text-xs text-center">Authentication (choose one)</Text>

          <View>
            <View className="flex-row items-center mb-2 ml-1">
              <Text className="text-slate-400 text-sm">Password</Text>
              {hasStoredPassword && (
                <View className="flex-row items-center ml-2">
                  <Lock size={12} color="#22c55e" />
                  <Text className="text-green-500 text-xs ml-1">Stored securely</Text>
                </View>
              )}
            </View>
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (text !== password) setHasStoredPassword(false);
              }}
              placeholder="Enter password"
              placeholderTextColor="#64748b"
              secureTextEntry
              className={inputStyle}
            />
          </View>

          <View>
            <Text className="text-slate-400 text-sm mb-2 ml-1">Private Key (PEM format)</Text>
            <TextInput
              value={privateKey}
              onChangeText={setPrivateKey}
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              className={`${inputStyle} min-h-[100px]`}
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {!isNew && onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              className="flex-row items-center justify-center gap-2 bg-red-900/30 py-3 rounded-xl mt-4"
            >
              <Trash2 size={18} color="#ef4444" />
              <Text className="text-red-400 font-medium">Delete Server</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
