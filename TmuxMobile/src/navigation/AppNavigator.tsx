import React, { forwardRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useWindowDimensions } from 'react-native';
import { SessionTreeSidebar } from '../components/SessionTreeSidebar';
import { TerminalScreen } from '../screens/TerminalScreen';
import { ServerListScreen } from '../screens/ServerListScreen';
import { ServerDetailScreen } from '../screens/ServerDetailScreen';
import { ServerEditScreen } from '../screens/ServerEditScreen';
import { Server, TmuxSession, TmuxWindow } from '../types';

export type DrawerParamList = {
  ServerList: undefined;
  ServerDetail: { server: Server };
  ServerEdit: { server?: Server } | undefined;
  Terminal: { server: Server; session: TmuxSession; window: TmuxWindow };
};

const Drawer = createDrawerNavigator<DrawerParamList>();

interface AppNavigatorProps {
  servers: Server[];
  onServerClick: (server: Server) => Promise<void>;
  onAddServer: () => void;
  onSaveServer: (server: Server) => void;
  onDeleteServer: (serverId: number) => void;
  onOpenAI: () => void;
}

export const AppNavigator = forwardRef<NavigationContainerRef<DrawerParamList>, AppNavigatorProps>(
  function AppNavigator(
    {
      servers,
      onServerClick,
      onAddServer,
      onSaveServer,
      onDeleteServer,
      onOpenAI,
    }: AppNavigatorProps,
    ref,
  ) {
    const dimensions = useWindowDimensions();
    const isLargeScreen = dimensions.width >= 768;

    return (
      <NavigationContainer ref={ref}>
        <Drawer.Navigator
          drawerContent={(props) => (
            <SessionTreeSidebar
              {...props}
              servers={servers}
              onServerClick={onServerClick}
              onAddServer={onAddServer}
            />
          )}
          screenOptions={{
            headerShown: false,
            drawerType: isLargeScreen ? 'permanent' : 'front',
            drawerStyle: {
              width: isLargeScreen ? 300 : '85%',
              backgroundColor: '#020617',
            },
            swipeEnabled: !isLargeScreen,
            overlayColor: isLargeScreen ? 'transparent' : 'rgba(0,0,0,0.6)',
          }}
        >
          <Drawer.Screen name="ServerList">
            {(props) => (
              <ServerListScreen
                {...props}
                servers={servers}
                onServerClick={onServerClick}
                onAddServer={onAddServer}
              />
            )}
          </Drawer.Screen>

          <Drawer.Screen name="ServerDetail">
            {(props) => {
              const server = props.route.params?.server;
              if (!server) return null;
              return (
                <ServerDetailScreen
                  server={server}
                  onBack={() => props.navigation.navigate('ServerList')}
                  onSessionClick={(session, window) => {
                    props.navigation.navigate('Terminal', { server, session, window });
                  }}
                />
              );
            }}
          </Drawer.Screen>

          <Drawer.Screen
            name="ServerEdit"
            options={{
              drawerItemStyle: { display: 'none' },
            }}
          >
            {(props) => (
              <ServerEditScreen
                server={props.route.params?.server}
                onSave={onSaveServer}
                onDelete={props.route.params?.server ? onDeleteServer : undefined}
                onBack={() => props.navigation.goBack()}
              />
            )}
          </Drawer.Screen>

          <Drawer.Screen name="Terminal">
            {(props) => {
              const params = props.route.params;
              if (!params?.server || !params?.session || !params?.window) return null;
              return (
                <TerminalScreen
                  server={params.server}
                  session={params.session}
                  window={params.window}
                  onBack={() => props.navigation.goBack()}
                  onOpenAI={onOpenAI}
                />
              );
            }}
          </Drawer.Screen>
        </Drawer.Navigator>
      </NavigationContainer>
    );
  },
);
