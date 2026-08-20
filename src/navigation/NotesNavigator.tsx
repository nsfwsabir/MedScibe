import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotesStackParamList } from './types';
import { HomeScreen } from '../screens/notes/HomeScreen';
import { NoteDetailScreen } from '../screens/notes/NoteDetailScreen';
import { NoteEditScreen } from '../screens/notes/NoteEditScreen';
import { RecordingScreen } from '../screens/notes/RecordingScreen';
import { ProcessingScreen } from '../screens/notes/ProcessingScreen';

const Stack = createNativeStackNavigator<NotesStackParamList>();

export function NotesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="NoteDetail" component={NoteDetailScreen} />
      <Stack.Screen name="NoteEdit" component={NoteEditScreen} />
      <Stack.Screen name="Recording" component={RecordingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Processing" component={ProcessingScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
