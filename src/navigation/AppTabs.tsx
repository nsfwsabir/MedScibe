import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootTabParamList } from './types';
import { NotesNavigator } from './NotesNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import { TabBar } from './TabBar';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="NotesTab" component={NotesNavigator} />
      <Tab.Screen name="NewNoteTab" component={NotesNavigator} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="SettingsTab" component={SettingsNavigator} />
    </Tab.Navigator>
  );
}
