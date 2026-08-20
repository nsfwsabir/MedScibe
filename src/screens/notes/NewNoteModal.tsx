import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { useUiStore } from '../../features/ui/uiStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

export function NewNoteModal() {
  const visible = useUiStore((s) => s.newNoteModalVisible);
  const setVisible = useUiStore((s) => s.setNewNoteModalVisible);
  const navigation = useNavigation<NativeStackNavigationProp<NotesStackParamList>>();

  const startNote = () => {
    setVisible(false);
    navigation.navigate('Recording');
  };

  return (
    <BottomSheet visible={visible} onClose={() => setVisible(false)}>
      <View style={styles.header}>
        <Text style={[typography.title, { color: colors.text }]}>Start New Note</Text>
        <Text style={[typography.body, { color: colors.muted }]}>
          Dictate a note and MedScribe will turn it into clean text.
        </Text>
      </View>

      <Pressable onPress={startNote} >
        <Card style={styles.target}>
          <Text style={styles.targetIcon}>🎙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodySemibold, { color: colors.text }]}>Quick Dictation</Text>
            <Text style={[typography.caption, { color: colors.muted }]}>
              Dictate after the visit, get a clean note
            </Text>
          </View>
          <Text style={[typography.title, { color: colors.muted }]}>›</Text>
        </Card>
      </Pressable>

      <Button label="Cancel" variant="ghost" onPress={() => setVisible(false)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetIcon: {
    fontSize: 22,
  },
});