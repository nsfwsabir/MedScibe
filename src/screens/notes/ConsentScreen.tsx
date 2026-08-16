import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackIcon, InfoIcon } from '../../components/ui/icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<NotesStackParamList, 'Consent'>;

export function ConsentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { noteType } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <BackIcon />
        </Pressable>
        <Text style={[typography.title, { color: colors.text }]}>Consent Reminder</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Card style={styles.card}>
          <InfoIcon size={24} color={colors.primary} />
          <Text style={[typography.body, styles.cardBody]}>
            Let your patient know {"you're"} recording this visit. A quick heads-up maintains the
            trusting connection of your practice.
          </Text>
          <Text style={[typography.caption, styles.cardNote]}>
            MedScribe securely parses audio only for clinical documentation and does not store
            conversational records permanently.
          </Text>
        </Card>

        <Button
          label={"I've Informed My Patient"}
          size="lg"
          onPress={() => navigation.replace('Recording', { noteType })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardBody: {
    color: colors.text,
    textAlign: 'center',
  },
  cardNote: {
    color: colors.muted,
    textAlign: 'center',
  },
});