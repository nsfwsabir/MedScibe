import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStackParamList } from './types';
import { SettingsScreen } from '../screens/settings/SettingsScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
