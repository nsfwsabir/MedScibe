import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotesStackParamList } from './types';
import { HomeScreen } from '../screens/notes/HomeScreen';
import { NoteDetailScreen } from '../screens/notes/NoteDetailScreen';
import { NoteEditScreen } from '../screens/notes/NoteEditScreen';

const Stack = createNativeStackNavigator<NotesStackParamList>();

export function NotesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="NoteDetail" component={NoteDetailScreen} />
      <Stack.Screen name="NoteEdit" component={NoteEditScreen} />
    </Stack.Navigator>
  );
}
